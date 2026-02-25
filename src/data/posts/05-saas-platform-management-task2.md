---
title: 'SaaS 플랫폼 운영 (2)'
publishDate: '2026-02-25'
description: '초보 엔지니어의 Kubernetes 플랫폼 운영 적응기 ②'
introText: 'Kubernetes 기반 플랫폼을 운영하며, 모니터링·CI/CD·보안 자동화를 통해 장애 대응 속도와 운영 안정성을 지속적으로 개선'
author: '말랑누오'
tags: ['Kubernetes', 'Istio', 'GitOps', 'Observability']
slug: 'saas-platform-management-task2'
---

# [회고] SaaS 플랫폼 운영 (2)


<br>

## 플랫폼 운영 적응기 ② - OPA Gatekeeper
<br>

플랫폼 운영을 경험하면서 Observability의 중요성을 직접 체감할 수 있었습니다. 
처음에는 단순히 모니터링 도구라고만 생각했지만, 실제로는 확인하는 데 유용했고, **메트릭**은 시스템의 전반적인 **상태 변화**를 파악하는 데 도움이 되었으며, **트레이스**는 서비스 간 호출 관계와 **지연 구간**을 파악하는 데 중요한 역할을 했습니다.

초기와는 달리 **OpenTelemetry 도입** 이후에는 데이터를 보다 일관된 방식으로 수집할 수 있게 되면서, 장애 분석 과정이 더욱 효율적으로 개선되었습니다.

