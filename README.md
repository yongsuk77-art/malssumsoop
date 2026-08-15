# 말씀숲

설교자가 한 절을 번역본, 히브리어·헬라어 원문, 형태 분석, 스트롱 사전, 주석과 함께 읽고 설교의 중심을 정리할 수 있는 설치형 웹 성경입니다.

## 주요 기능

- 구약 Open Scriptures Hebrew Bible, 신약 STEPBible TAGNT-TR 원문과 형태 분석
- 최대 4개 번역본 동시 비교와 장·절 동기화
- 베들레헴 `.bdb`, `.sdb`, `.cdb`, `.dct`, `.hdb` 파일 직접 가져오기
- 스트롱 코드 연결, 한글·영문 원어사전, 주석 검색
- 본문·원어·문맥을 함께 사용하는 절별 AI 설교 통찰
- 찬송가 번호·제목·가사 검색
- 데스크톱 3단 연구 화면과 모바일 탭 화면
- 오프라인 캐시와 홈 화면 설치를 지원하는 PWA

## 베들레헴 자료 연결

앱에서 `자료실` → `베들레헴 자료 선택`을 누르고 여러 파일을 함께 선택합니다. 추천 순서는 다음과 같습니다.

1. `01개역개정.bdb` — 주로 읽을 번역본
2. `개역개정S.sdb` — 번역 어절과 스트롱 코드 연결
3. `HebGrkKo.dct` — 한글 히브리어·헬라어 사전
4. `만나주석.cdb` — 절별 주석
5. `새찬송가.hdb` — 찬송가 제목과 가사

가져온 원본 파일은 브라우저 IndexedDB에만 저장되며 서버로 업로드되지 않습니다. 단, 사용자가 `이 절의 통찰 보기`를 누르면 선택한 절, 앞뒤 절과 원어 분석 정보가 Cloudflare Workers AI로 전송됩니다. 생성 결과는 연구 보조 자료이며 설교자의 문맥·신학 검토를 대신하지 않습니다.

## 개발

Node.js 24 이상을 권장합니다.

```bash
npm install
npm run check
npm test
npm run build
npm run dev
```

공개 원문 자료를 다시 생성할 때는 원본 패키지와 WEB SQLite 파일을 `.source` 아래에 둔 뒤 `node scripts/build_open_data.mjs`를 실행합니다. `.source`와 베들레헴 확장자는 Git에서 제외됩니다.

## Cloudflare 배포

Workers Static Assets와 Workers AI 바인딩을 사용합니다.

```bash
npm run deploy:dry
npm run deploy
```

배포 설정은 `wrangler.jsonc`, API 코드는 `worker/index.ts`에 있습니다. 별도의 AI 키를 클라이언트에 노출하지 않으며, 통찰 API에는 Cloudflare Rate Limiting 바인딩을 적용합니다.

## 모바일 설치

- Android Chrome: 앱 우측 상단 설정 → `앱으로 설치`, 또는 브라우저 메뉴 → `앱 설치`
- iPhone/iPad Safari: 공유 → `홈 화면에 추가`

## 라이선스

애플리케이션 코드는 MIT입니다. 공개 성경 자료와 사용자가 가져오는 자료의 권리는 별도로 적용됩니다. 자세한 내용은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 확인하세요.
