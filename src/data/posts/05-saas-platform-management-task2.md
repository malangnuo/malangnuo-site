---
title: 'SaaS 플랫폼 운영 (2) - OPA Gatekeeper'
publishDate: '2026-02-25'
description: '초보 엔지니어의 Kubernetes 플랫폼 운영 적응기 ②'
introText: 'Kubernetes 기반 플랫폼을 운영하며, 모니터링·CI/CD·보안 자동화를 통해 장애 대응 속도와 운영 안정성을 지속적으로 개선'
author: '말랑누오'
tags: ['Kubernetes', 'Istio', 'GitOps', 'Observability']
slug: 'saas-platform-management-task2'
---

# [회고] SaaS 플랫폼 운영 (2)
<hr>

이 글은 **SaaS 플랫폼 운영 1편**에서 이어지는 내용입니다.
> [SaaS 플랫폼 운영 (1) - Observability](https://malangnuo.com/posts/saas-platform-management-task1/)

<br>

## 플랫폼 운영 적응기 ② - OPA Gatekeeper

플랫폼 운영에 점차 익숙해질 무렵, Kubernetes 환경에서의 **정책 관리**와 **보안 통제**의 중요성을 체감하게 되었고, 그 과정에서 **OPA Gatekeeper**를 처음 접하게 되었습니다. 기존에는 리소스를 생성하고 운영하는 것에 집중했다면, 이 시기부터는 “어떤 리소스가 생성되어야 하는가”를 통제하는 정책의 필요성을 이해하고 직접 다루게 되었습니다.

<br>

### 정책 기반 관리의 필요성
쿠버네티스는 매우 유연한 플랫폼이지만, 그만큼 잘못된 설정으로 인해 발생할 수 있는 위험도 존재합니다. 예를 들면 다음과 같은 것들이죠. 
```txt
- privileged 컨테이너 실행
- 리소스 제한 없이 배포되는 Pod
- 특정 namespace에 대한 무분별한 리소스 생성
- 허용되지 않은 이미지 사용
etc.
```
이러한 설정들은 보안 문제나 시스템 안정성 저하로 이어질 수 있습니다.

초기에는 이러한 부분들을 운영자의 검토나 가이드에 의존하고 있었지만, 플랫폼 규모가 커질수록 사람이 일일이 확인하는 방식에는 한계가 있었습니다. 이를 해결하기 위해 정책을 **코드**로 정의하고, 리소스 생성 단계에서 **자동**으로 검증하는 방식이 필요했고, 그 해결책이 바로 OPA Gatekeeper였습니다

<br>

### OPA Gatekeeper란 무엇인가
OPA Gatekeeper는 쿠버네티스에서 **정책 기반 검증(Policy Enforcement)**을 가능하게 해주는 **Admission Controller**입니다. <br>
CNCF 생태계에서 널리 사용되는 정책 엔진인 **Open Policy Agent(OPA)를** 쿠버네티스 환경에 통합하여, 리소스 생성 및 변경 시 정의된 정책을 기준으로 허용 또는 거부할 수 있도록 합니다.

Gatekeeper는 Kubernetes API Server로 요청이 들어오는 시점에 동작하여, 정책을 위반하는 리소스가 생성되지 않도록 사전에 차단하는 역할을 합니다.

이를 통해 다음과 같은 정책을 강제할 수 있습니다.
```txt
- 특정 label이 없는 리소스 생성 금지
- 리소스 limit이 설정되지 않은 Pod 생성 금지
- 허용되지 않은 registry 이미지 사용 제한
- privileged 컨테이너 실행 제한
etc.
```
<br>

### Gatekeeper의 주요 구성 요소 이해
Gatekeeper를 처음 접했을 때 가장 어려웠던 부분은 구조와 동작 방식을 이해하는 것이었습니다. <br>
Gatekeeper는 크게 두 가지 핵심 리소스를 중심으로 동작합니다. <br>

#### ConstraintTemplate
ConstraintTemplate은 정책의 "틀"을 정의하는 리소스입니다.
이 안에는 Rego라는 정책 언어로 작성된 검증 로직이 포함되어 있으며, 어떤 기준으로 리소스를 검사할 것인지 정의합니다. 
즉, ConstraintTemplate은 정책의 로직 자체를 정의하는 역할을 합니다.

#### Constraint
Constraint는 ConstraintTemplate을 기반으로 실제로 적용되는 정책입니다.
예를 들어,
- 어떤 namespace에 적용할지
- 어떤 리소스 종류에 적용할지
와 같은 적용 범위를 적용합니다.
ConstraintTemplate이 정책의 정의라면, Constraint는 정책의 실제 적용이라고 이해할 수 있습니다.

<hr>

## 마무리
Gatekeeper를 운영하면서 단순히 리소스를 관리하는 것을 넘어, 플랫폼의 안정성과 일관성을 유지하는 정책 관리의 중요성을 이해하게 되었습니다.
특히 다음과 같은 부분에서 큰 도움이 되었습니다.
- 잘못된 설정의 리소스가 생성되는 것을 사전에 방지
- 운영 환경의 일관성 유지
- 보안 기준을 정책으로 강제
- 운영자의 수작업 검증 부담 감소
또한 쿠버네티스 플랫폼 운영에서 단순한 리소스 관리뿐만 아니라, 정책 기반 통제 또한 중요한 역할을 한다는 것을 직접 경험할 수 있었습니다.
