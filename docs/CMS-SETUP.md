# 관리자 화면 연결

관리자 URL: https://malangnuo.com/admin/

Decap CMS → GitHub → 기존 Cloudflare 배포 순서로 작동합니다. 기존 제목·본문·파일은 변경하지 않습니다. GitHub에 저장소 쓰기 권한이 있는 계정으로 로그인합니다. 관리자 경로가 공개되어도 로그인 없이 글을 저장할 수 없습니다.

## 최초 연결 (계정 소유자 설정)

1. GitHub Settings → Developer settings → OAuth Apps에서 앱을 생성합니다.
   - Homepage URL: https://malangnuo.com
   - Authorization callback URL: https://malangnuo.com/cms-auth/callback
2. Cloudflare Worker `malangnuo-cms-auth`를 생성해 `workers/cms-auth/index.js`를 배포합니다. 기존 사이트 배포와 별개인 로그인 전용 Worker입니다. Pages와 Workers 정적 사이트 모두에서 사용할 수 있습니다.
3. Worker 환경 변수에 `CMS_ORIGIN=https://malangnuo.com`, `GITHUB_REPO=malangnuo/malangnuo-site`를 설정하고, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`을 secret으로 설정합니다. 비밀키는 저장소나 관리자 HTML에 넣지 않습니다.
4. Worker Route를 `malangnuo.com/cms-auth/*`로 연결합니다. 해당 도메인이 Cloudflare 프록시를 통과해야 합니다. 사이트 호스트가 www 등 다른 주소라면 config.yml, Worker origin과 route, OAuth callback을 같은 호스트로 함께 바꿉니다.
5. 이 저장소 변경을 기존 방식으로 Cloudflare에 배포합니다. `main` 변경이 자동 배포되는 Git 연결인지 확인합니다. 직접 업로드 방식이라면 자동 배포 연결이 추가로 필요합니다.
6. /admin/에서 로그인 → 기존 글 확인 → 새 초안 저장 → 검토 → 발행을 확인합니다. 발행은 main 브랜치에 반영되고 Cloudflare 배포가 완료된 뒤 공개됩니다.

CLI를 쓴다면 Worker 디렉터리에서 아래 명령을 실행합니다 (Wrangler 설치 및 Cloudflare 로그인 필요).

```sh
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler deploy
```

## 사용

- 포스팅 → 새 포스팅에서 제목, 주소, 발행일, 목록 설명, 소개 문구, 작성자, 태그, 본문을 작성합니다.
- 본문 첫 줄은 `# 제목`으로 작성합니다. 현재 블로그는 본문 H1을 표시합니다.
- 글 주소는 영문 소문자와 하이픈으로 작성하고 발행 후 유지합니다. 기존 글도 slug를 바꾸지 않습니다.
- 저장은 별도 CMS 브랜치의 초안입니다. 검토 후 발행할 때만 main에 합쳐집니다.
- 이미지 버튼으로 업로드하면 public/uploads에 저장됩니다. 기존 글의 상대 이미지 경로는 그대로 유지합니다.
- 미래 발행일은 예약 발행이 아닙니다. 공개 전에는 초안 상태로 유지하세요.
- 삭제는 관리자 화면에서 비활성화했습니다.
- GitHub OAuth public_repo 권한을 사용하므로 공개 저장소에 맞춘 구성입니다. 비공개 저장소로 바꾸면 인증 범위 검토가 필요합니다.

## 로컬 확인 및 검증 범위

Astro 개발 서버에서 /admin/의 편집기와 로그인 버튼을 볼 수 있습니다. 로컬 저장소 직접 쓰기는 켜지 않았습니다. 실제 GitHub 인증은 배포 도메인의 OAuth Worker 연결 후 가능합니다. 현재 외부 계정 설정·배포·발행은 수행하지 않았으며 빌드도 실행하지 않았습니다.

공식 문서: https://decapcms.org/docs/github-backend/ · https://decapcms.org/docs/editorial-workflows/

## 현재 운영 연결

Cloudflare 로그인 Worker와 `/cms-auth/*` 라우팅 및 암호화된 OAuth secret이 설정되어 있습니다.
Cloudflare Access는 `malangnuo.com/admin` 및 하위 경로에 적용되어 있으며, `malangnuo@gmail.com`만 이메일 PIN 인증으로 허용합니다.
Pages의 기본/미리보기 도메인에서 관리자 경로에 접근하면 Pages middleware가 보호된 운영 도메인으로 이동시킵니다.
