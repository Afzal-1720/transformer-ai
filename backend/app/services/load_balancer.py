from typing import List
from app.models.load_balancing import (
    LoadTransferRequest, LoadTransferResponse, ScenarioVerdict
)
from app.services.storage import storage
from app.services.risk_engine import risk_engine

class LoadBalancingOptimizer:
    def simulate_transfer(self, req: LoadTransferRequest) -> LoadTransferResponse:
        source_spec = storage.get_transformer(req.source_id)
        target_spec = storage.get_transformer(req.target_id)

        if not source_spec:
            raise ValueError(f"Source transformer {req.source_id} not found")
        if not target_spec:
            raise ValueError(f"Target transformer {req.target_id} not found")

        if req.source_id == req.target_id:
            raise ValueError("Source and target transformers cannot be identical")

        source_telemetry = storage.get_latest_telemetry(req.source_id)
        target_telemetry = storage.get_latest_telemetry(req.target_id)

        source_pre_kva = source_telemetry.apparent_power_kva if source_telemetry else source_spec.rated_capacity_kva * 0.7
        target_pre_kva = target_telemetry.apparent_power_kva if target_telemetry else target_spec.rated_capacity_kva * 0.5

        source_pre_pct = round((source_pre_kva / source_spec.rated_capacity_kva) * 100.0, 1)
        target_pre_pct = round((target_pre_kva / target_spec.rated_capacity_kva) * 100.0, 1)

        # Projected loading
        transfer_kva = req.transfer_kva
        source_post_kva = max(0.0, round(source_pre_kva - transfer_kva, 1))
        target_post_kva = round(target_pre_kva + transfer_kva, 1)

        source_post_pct = round((source_post_kva / source_spec.rated_capacity_kva) * 100.0, 1)
        target_post_pct = round((target_post_kva / target_spec.rated_capacity_kva) * 100.0, 1)

        target_headroom_kva = round(target_spec.rated_capacity_kva - target_post_kva, 1)

        # Pre-transfer risks
        pre_source_risk = risk_engine.assess_risk(req.source_id).overall_risk_score
        pre_target_risk = risk_engine.assess_risk(req.target_id).overall_risk_score

        # Projected risks after transfer (heuristic delta)
        # Source relieved:
        relief_ratio = min(1.0, transfer_kva / max(source_pre_kva, 1.0))
        post_source_risk = round(max(10.0, pre_source_risk * (1.0 - relief_ratio * 0.55)), 1)

        # Target loaded:
        stress_increase = max(0.0, (target_post_pct - 70.0) / 30.0) * 45.0
        post_target_risk = round(min(100.0, pre_target_risk + stress_increase), 1)

        safety_limit = req.safety_margin_pct
        warnings = []
        is_connected = (
            req.target_id in source_spec.connected_substations or
            req.source_id in target_spec.connected_substations or
            source_spec.zone == target_spec.zone or
            "Central" in source_spec.zone or "Central" in target_spec.zone
        )

        if not is_connected:
            warnings.append(
                f"No direct tie-line switch between {source_spec.zone} and {target_spec.zone}. "
                "Transfer requires multi-hop ring routing via Central Substation TX-501."
            )

        # Verdict logic
        if target_post_pct > 100.0:
            verdict = ScenarioVerdict.REJECTED
            feasible = False
            explanation = (
                f"Transfer REJECTED: Proposed transfer of {transfer_kva:.0f} kVA overloads target {target_spec.name} "
                f"to {target_post_pct:.1f}% (>100% rated capacity). Exceeds thermal damage limit."
            )
            warnings.append(f"Target capacity deficit: {abs(target_headroom_kva):.1f} kVA shortfall.")
        elif target_post_pct > safety_limit:
            verdict = ScenarioVerdict.WARNING
            feasible = True
            explanation = (
                f"Transfer ACCEPTABLE WITH WARNING: Relieves {source_spec.id} down to {source_post_pct:.1f}%, "
                f"but elevates {target_spec.id} to {target_post_pct:.1f}%, exceeding the configured {safety_limit:.0f}% safety margin."
            )
            warnings.append(f"Target operates above {safety_limit:.0f}% continuous design margin.")
        else:
            verdict = ScenarioVerdict.APPROVED
            feasible = True
            explanation = (
                f"Transfer APPROVED: Optimally shifts {transfer_kva:.0f} kVA. "
                f"{source_spec.id} load drops from {source_pre_pct:.1f}% to {source_post_pct:.1f}%. "
                f"{target_spec.id} maintains healthy {target_post_pct:.1f}% load with {target_headroom_kva:.0f} kVA remaining headroom."
            )

        # Path topology
        if req.target_id in source_spec.connected_substations:
            path = [source_spec.name, f"Direct Feeder Tie ({source_spec.zone})", target_spec.name]
        else:
            path = [source_spec.name, "Zone Distribution Bus", "Central Inter-tie TX-501", target_spec.name]

        return LoadTransferResponse(
            feasible=feasible,
            verdict=verdict,
            source_id=req.source_id,
            target_id=req.target_id,
            transfer_kva=transfer_kva,
            source_name=source_spec.name,
            target_name=target_spec.name,
            source_pre_load_kva=source_pre_kva,
            source_post_load_kva=source_post_kva,
            source_pre_pct=source_pre_pct,
            source_post_pct=source_post_pct,
            target_pre_load_kva=target_pre_kva,
            target_post_load_kva=target_post_kva,
            target_pre_pct=target_pre_pct,
            target_post_pct=target_post_pct,
            target_rated_kva=target_spec.rated_capacity_kva,
            target_remaining_headroom_kva=target_headroom_kva,
            pre_source_risk=pre_source_risk,
            post_source_risk=post_source_risk,
            pre_target_risk=pre_target_risk,
            post_target_risk=post_target_risk,
            explanation=explanation,
            safety_warnings=warnings,
            interconnection_path=path,
            is_simulated=True
        )

load_balancer = LoadBalancingOptimizer()
