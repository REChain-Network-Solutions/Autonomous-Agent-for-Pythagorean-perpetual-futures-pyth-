# API (if exposed)

This agent may expose metrics for monitoring:

## GET /metrics/status
Returns operational status of the agent

## GET /metrics/positions
Returns current position exposure breakdown

## GET /metrics/performance
Returns historical performance and PnL summary

## POST /admin/trigger-rebalance
Manually trigger rebalance (auth required)