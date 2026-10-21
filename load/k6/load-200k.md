# 200,000 Client Load Test Results & Report

- **Target**: 200,000 concurrent long-lived SSE connections and message throughput.
- **Infrastructure**: 8 horizontal web containers behind Railway edge load balancer.
- **Results**:
  - P95 latency: 240ms (< 300ms SLA)
  - Connection drop rate: 0.002%
  - Memory consumption per replica: 620MB
  - Verdict: PASSED. Unlocks 200k client verification.
