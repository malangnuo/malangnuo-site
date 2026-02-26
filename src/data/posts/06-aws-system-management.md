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
S기업의 AWS 마이그레이션 프로젝트를 끝마침과 동시에 운영까지 이어서 맡게 되었습니다. 
> [AWS 마이그레이션 프로젝트 내용 확인하기](https://malangnuo.com/posts/on-prem-to-aws-cloud-migration/)

AWS 인프라 운영을 맡게 되면서 단순히 서버를 관리하는 것을 넘어, 실제 서비스가 안정적으로 운영되도록 유지하고 개선하는 역할을 수행하게 되었습니다.


## 운영 안정성과 효율성
제가 AWS 운영을 맡으며 가장 중요하게 생각한 것은 운영 안정성과 효율성이었습니다.

운영 환경에서는 다음과 같은 요구사항이 지속적으로 발생했습니다.
- 사용하지 않는 리소스의 비용 절감
- 정기적인 백업을 통한 복구 가능성 확보
- 운영 리소스 상태 및 비용 관리

이러한 요구사항을 해결하기 위해 AWS Lambda, DLM(Data Lifecycle Manager), S3 등을 활용하여 다양한 운영 자동화를 구축했습니다.

이 글에서는 실제 운영 환경에서 구축했던 자동화 및 백업 사례를 공유하고자 합니다.

---

## 운영 자동화 - ① Lambda 기반 EC2 자동 중지 및 재시작
운영 환경에서는 업무 시간 외에 사용하지 않는 서버들이 존재했습니다.

이 서버들을 계속 실행 상태로 유지할 경우 불필요한 비용이 발생하기 떄문에, 자동으로 중지 및 재시작하는 자동화가 필요했습니다.
<br>

### 해결 방법
EC2 태그 기반으로 특정 서버만 자동 제어하도록 Lambda를 구성했습니다.

```txt
AutoStopStart = Yes
```

### 동작 구조
- EventBridge -> Lambda 실행 (정해진 시간)
- Lambda -> 태그 기반 EC2 조회
- 서버 중지 또는 시작 수행

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

### 결과
- 업무 시간 외 자동 서버 중지
- 업무 시작 시간 자동 재시작
- 불필요한 비용 절감
- 수동 작업 제거


태그 기반으로 자동화를 구성함으로서 운영 환경에서 유연한 제어를 할 수 있었습니다.

---

## 운영 자동화 - ② EC2 및 EBS 비용 리포트 자동 생성
운영 중 서버 및 EBS 볼륨별 비용을 정기적으로 확인해야할 필요가 있었습니다.

기존에는 콘솔에서 직접 확인해야 했기 때문에 시간이 소요되고 관리가 어려웠습니다.

이를 해결하기 위해 비용 리포트를 자동으로 생성하여 S3에 저장하는 자동화를 구축했습니다.

### 목표
- EC2 및 EBS 비용 데이터 자동 수집
- Excel 파일로 자동 생성
- S3에 자동 저장

### 구성
- AWS Lambda 
- Cost Explorer API
- S3
- EventBridge (주 1회 실행)

### 동작 흐름
1. EventBridge -> Lambda 실행
2. Lambda -> Cost Explorer API 호출
3. 서버 및 볼륨 비용 조회
4. Excel 파일 생성
5. S3 업로드

```python
import boto3
import json
import io
from datetime import date
from openpyxl import Workbook

REGION = 'ap-northeast-2'
S3_BUCKET = 's3-skons-cost-01'  
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

### 결과 
- 비용 데이터 자동 수집
- 비용 추이 관리 가능
- 운영 가시성 향상

운영 환경에서는 비용 또한 중요한 운영 지표이며, 이를 자동으로 수집하는 것이 매우 중요하다는 것을 알 수 있었습니다.