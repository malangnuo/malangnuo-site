---
title: 'AWS 시스템 운영 (1) - 운영 자동화'
publishDate: '2026-2-25'
description: 'AWS 마이그레이션 이후 운영 및 안정화 ①'
introText: 'AWS 마이그레이션 후 운영하며, 모니터링·비용 최적화·자동화를 통해 안정적이고 효율적인 클라우드 운영 체계를 유지'
author: '말랑누오'
tags: ['AWS', 'Python', 'Grafana']
slug: 'aws-system-management'
---

# [회고] AWS 시스템 운영 (1)
---
S기업의 AWS 마이그레이션 프로젝트를 성공적으로 마침과 동시에, 해당 인프라의 운영 업무까지 이어서 맡게 되었습니다.
> [AWS 마이그레이션 프로젝트 내용 확인하기](https://malangnuo.com/posts/on-prem-to-aws-cloud-migration/)

단순히 서버의 상태를 체크하는 것을 넘어, 클라우드 네이티브한 기능을 활용해 실제 서비스가 **안정적으로 운영**되도록 유지하고 **비용 효율성**을 개선하는 데 초점을 맞추었습니다.

### 운영 중 직면한 핵심 요구사항
1. **비용 절감:** 업무 시간 외 미사용 리소스의 방치 방지
2. **복구 가용성:** 정기적인 백업 체계 마련
3. **가시성 확보:** 운영 리소스 상태 및 비용 데이터의 주기적 모니터링

이러한 문제를 해결하기 위해 AWS Lambda, EventBridge, S3 등을 조합하여 구축한 자동화 사례를 소개합니다.

---

## 운영 자동화 - ① Lambda 기반 EC2 스케줄링 (자동 중지/시작)
개발 및 테스트 환경 등 업무 시간 외에 계속 켜둘 필요가 없는 서버들이 존재했습니다.

이를 방치하면 불필요한 비용이 발생하므로, 정해진 시간에 맞춰 서버를 제어하는 자동화 프로세스를 구축했습니다.
<br>

### 구현 방식
특정 태그가 설정된 인스턴스만을 식별하여 제어하도록 설계해 유연성을 확보했습니다.
```txt
AutoStopStart = Yes
```

- **Trigger:** EventBridge (Cron 표현식을 사용해 특정 시간 설정)
- **Logic:** Lambda(Python/Boto3)가 태그 필터링을 통해 대상 인스턴스 조회 후 <code>stop_instances></code> 또는 <code>start_instances</code> 실행


```python
import boto3

ec2 = boto3.client("ec2")

TAG_KEY = "AutoStopStart"
TAG_VALUE = "Yes"

def lambda_handler(event, context):

    action = event.get("action", "stop")
    instances = []

    response = ec2.describe_instances(
        Filters=[{"Name": f"tag:{TAG_KEY}", "Values": [TAG_VALUE]}]
    )

    for reservation in response["Reservations"]:
        for instance in reservation["Instances"]:
            instances.append(instance["InstanceId"])

    if not instances:
        return {"status": "no instances found"}

    if action == "stop":
        ec2.stop_instances(InstanceIds=instances)
        return {"status": f"stopped {len(instances)} instances", "instances": instances}

    elif action == "start":
        ec2.start_instances(InstanceIds=instances)
        return {"status": f"started {len(instances)} instances", "instances": instances}

    else:
        return {"status": "invalid action"}
```

### 결과 및 성과
- **비용 최적화:** 업무 외 시간(야간/주간) 비용 발생 원천 차단
- **운영 편의성:** 수동 작업 제거로 인적 실수 방지 및 관리 효율 향상

---

## 운영 자동화 - ② EC2 및 EBS 비용 리포트 자동 생성
인벤토리 현황과 볼륨별 비용을 정기적으로 보고해야 하는 니즈가 있었습니다.  

매번 콘솔에서 수기로 데이터를 취합하는 번거로움을 해결하고자, 비용 리포트를 엑셀 파일로 자동 생성하여 S3에 저장하는 파이프라인을 구축했습니다.

### 목표 및 구성
- **데이터 수집:** Cost Explorer API 및 EC2 Describe API 활용
- **파일 포맷:** 관리자가 보기 편한 Excel 형식 (openpyxl 라이브러리 사용)
- **보관:** S3 버킷에 주 단위(Weekly)로 자동 업로드

```python
import boto3
import json
import io
from datetime import date
from openpyxl import Workbook

REGION = '리전명'
S3_BUCKET = '버킷명'  
S3_KEY_PREFIX = 'ec2/'

ec2 = boto3.client('ec2', region_name=REGION)
pricing = boto3.client('pricing', region_name='us-east-1')
s3 = boto3.client('s3')

def collect_instances():
    instances = []
    reservations = ec2.describe_instances()['Reservations']
    for res in reservations:
        for i in res['Instances']:
            name = next((t['Value'] for t in i.get('Tags', []) if t['Key'] == 'Name'), i['InstanceId'])
            platform = next((t['Value'] for t in i.get('Tags', []) if t['Key'] == 'Platform'), 'Linux')

            # RDS 태그가 있는 인스턴스 제외
            if platform.upper() == 'RDS':
                continue

            instances.append({
                'Name': name,
                'InstanceId': i['InstanceId'],
                'InstanceType': i['InstanceType'],
                'State': i['State']['Name'],
                'AZ': i['Placement']['AvailabilityZone'],
                'Platform': platform
            })
    return instances

def collect_volumes():
    volumes = ec2.describe_volumes()['Volumes']
    volume_map = {}
    for vol in volumes:
        for att in vol['Attachments']:
            volume_map.setdefault(att['InstanceId'], []).append({
                'Size': vol['Size'],
                'Type': vol['VolumeType']
            })
    return volume_map

def get_ec2_price(instance_type, platform):
    os_map = {
        'Linux': 'Linux',
        'Windows': 'Windows',
        'Windows+SQLStd': 'Windows',
        'Windows+SQLEnt': 'Windows'
    }
    preinstalled_map = {
        'Linux': 'NA',
        'Windows': 'NA',
        'Windows+SQLStd': 'SQL Std',
        'Windows+SQLEnt': 'SQL Ent'
    }

    response = pricing.get_products(
        ServiceCode='AmazonEC2',
        Filters=[
            {'Type': 'TERM_MATCH', 'Field': 'instanceType', 'Value': instance_type},
            {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': 'Asia Pacific (Seoul)'},
            {'Type': 'TERM_MATCH', 'Field': 'operatingSystem', 'Value': os_map.get(platform, 'Linux')},
            {'Type': 'TERM_MATCH', 'Field': 'preInstalledSw', 'Value': preinstalled_map.get(platform, 'NA')},
            {'Type': 'TERM_MATCH', 'Field': 'tenancy', 'Value': 'Shared'}
        ],
        MaxResults=1
    )

    if not response['PriceList']:
        return 0, '-', '-'

    price_item = json.loads(response['PriceList'][0])
    terms = price_item['terms']['OnDemand']
    price = 0
    for t in terms.values():
        for dim in t['priceDimensions'].values():
            if dim['unit'] == 'Hrs':
                price = float(dim['pricePerUnit']['USD'])

    attrs = price_item['product']['attributes']
    vcpu = int(attrs.get('vcpu', 0))
    memory = attrs.get('memory', '-')
    return price, vcpu, memory

def get_ebs_price(vol_type):
    EBS_PRICES = {
        'gp3': 0.0912,
        'gp2': 0.114,
        'io1': 0.138,
        'io2': 0.138,
        'st1': 0.051,
        'sc1': 0.030
    }
    return EBS_PRICES.get(vol_type, 0.1)

def lambda_handler(event, context):
    instances = collect_instances()
    volume_map = collect_volumes()

    hours_in_month = 24 * date.today().day

    for inst in instances:
        ec2_price_per_hr, vcpu, memory = get_ec2_price(inst['InstanceType'], inst['Platform'])
        inst['vCPU'] = vcpu
        inst['Memory'] = memory

        inst['EC2MonthlyUSD'] = round(ec2_price_per_hr * hours_in_month, 2) if inst['State'] == 'running' else 0

        vol_cost = 0
        for vol in volume_map.get(inst['InstanceId'], []):
            vol_cost += vol['Size'] * get_ebs_price(vol['Type'])
        inst['VolumeSizeGB'] = sum(vol['Size'] for vol in volume_map.get(inst['InstanceId'], []))
        inst['EBSMonthlyUSD'] = round(vol_cost, 2)
        inst['TotalMonthlyUSD'] = inst['EC2MonthlyUSD'] + inst['EBSMonthlyUSD']

    wb = Workbook()
    ws1 = wb.active
    ws1.title = "EC2_Detail_Costs"
    ws1.append([
        "Name", "InstanceId", "InstanceType", "State", "AZ", "Platform", "vCPU", "Memory",
        "VolumeSize(GB)", "AttachedVolumes", "EC2Monthly(USD)", "EBSMonthly(USD)", "TotalMonthly(USD)"
    ])

    for inst in instances:
        attached_vols = [f"{v['Type']}:{v['Size']}GB" for v in volume_map.get(inst['InstanceId'], [])]
        attached_vols_str = ", ".join(attached_vols) if attached_vols else "-"
        ws1.append([
            inst['Name'], inst['InstanceId'], inst['InstanceType'], inst['State'], inst['AZ'],
            inst['Platform'], inst['vCPU'], inst['Memory'], inst['VolumeSizeGB'],
            attached_vols_str, inst['EC2MonthlyUSD'], inst['EBSMonthlyUSD'], inst['TotalMonthlyUSD']
        ])

    ws2 = wb.create_sheet(title="EBS_Summary")
    ebs_summary = {}
    for inst in instances:
        for vol in volume_map.get(inst['InstanceId'], []):
            vol_type = vol['Type']
            cost = vol['Size'] * get_ebs_price(vol_type)
            ebs_summary[vol_type] = ebs_summary.get(vol_type, 0) + cost

    ws2.append(["VolumeType", "TotalMonthlyUSD"])
    for vol_type, cost in ebs_summary.items():
        ws2.append([vol_type, round(cost, 2)])

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    s3_key = f"{S3_KEY_PREFIX}ec2_monthly_costs_{date.today().strftime('%Y%m%d')}.xlsx"
    s3.put_object(Bucket=S3_BUCKET, Key=s3_key, Body=buffer.getvalue())

    return {
        'statusCode': 200,
        'body': f"Report uploaded to s3://{S3_BUCKET}/{s3_key}"
    }
```

### 결과 및 기대 효과
- **가시성 확보:** 어떤 인스턴스가 비용을 많이 점유하는지 한눈에 파악 가능
- **데이터 자산화:** 주 단위 리포트 누적을 통해 비용 추이 분석 가능

---

## 마치며

운영 환경에서 **비용은 곧 기술적인 지표**입니다. 자동화 시스템을 통해 반복적인 업무를 줄이고, 데이터 기반의 운영 환경을 구축함으로써 보다 본질적인 인프라 개선 업무에 집중할 수 있는 기반을 마련할 수 있었습니다.