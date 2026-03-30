# Creator Connection — v1 Feature Plan

**Огноо:** 2026-03-31  
**Шийдэл:** Meta (Facebook + Instagram) API-г ашиглан creator өөрийн account-аа холбож, unified analytics харах систем.  
**Зарчим:** Phyllo болон гуравдагч талын aggregator ашиглахгүй — Meta API-тай шууд ажиллана.

---

## Зорилт

Монголын creator/байгууллага өөрийн Facebook Page болон Instagram Business account-аа MarTech-тэй холбож, нэг дэлгэц дээр analytics харах, AI зөвлөмж авах боломж олгох.

---

## v1 Feature Set

### 1. Creator Onboarding (холболт)
- Creator өөрийн **Facebook Page** эсвэл **Instagram Business** account холбодог
- Зөвшөөрлийн дэлгэц — юу авахыг тодорхой харуулна
- Холбогдсон account-уудын жагсаалт + disconnect хийх боломж

### 2. Unified Analytics Dashboard
- **Facebook Page:** Reach, impressions, engagement, fan count
- **Instagram:** Followers, reach, impressions, profile views
- Хоёрыг нэг дэлгэц дээр харьцуулж харах
- Өсөлт/бууралтын trend (7/14/30 хоног)

### 3. Post Performance
- FB + IG post-уудын metrics нэг газраас
- Хамгийн сайн ажилласан контент харах
- Post type (Reel vs Photo vs Story) харьцуулалт

### 4. AI Зөвлөмж (сайжруулсан)
- Одоо зөвхөн FB → **FB + IG хамтад** тулгуурласан зөвлөмж
- Cross-platform insight: "Instagram дээр Reel илүү reach авч байна, FB-д энэ format туршина уу" гэх мэт

---

## v1-д хасах (scope out)

- ❌ TikTok, YouTube — Meta-д л төвлөрнө
- ❌ Audience demographics detail — Meta App Review шаардлагатай
- ❌ Story metrics — нэмэлт permission
- ❌ Competitor analysis

---

## Техникийн архитектур

### Шийдвэр
Одоогийн **organization → page** бүтэцэд Instagram нэмэх (Хувилбар А).  
- Хурдан, одоогийн infrastructure-тай нийцэх
- Байгууллагын маркетинг менежер ашиглах зорилтод тохирсон

### Нэмэх Meta permissions
- `instagram_basic` — Instagram профайл
- `instagram_manage_insights` — Instagram analytics
- `pages_read_engagement` — аль хэдийн байгаа ✅

> ⚠️ Instagram зөвхөн **Business эсвэл Creator** account-д API өгдөг — personal account-д өгдөггүй.

### DB өөрчлөлт
- `meta_pages` — Instagram account холбох (page_type: 'instagram' нэмэх)
- `page_daily_metrics` / `page_post_metrics` — platform column нэмэх эсвэл тусдаа хүснэгт

---

## Хугацааны тооцоо

| Алхам | Ажил | Хугацаа |
|---|---|---|
| Instagram OAuth нэмэх | Meta app-д permission нэмж, token авах | 1-2 өдөр |
| Instagram sync | Metrics татах, DB-д хадгалах | 2-3 өдөр |
| Dashboard нэгтгэх | FB + IG хамт харуулах UI | 2-3 өдөр |
| AI сайжруулалт | Cross-platform signal нэмэх | 1-2 өдөр |
| **Нийт** | | **~1-1.5 долоо хоног** |

---

## Meta App Review

Production-д гаргахаасаа өмнө Meta-д app review хийлгэх шаардлагатай:
- Хүсэх permissions: `instagram_basic`, `instagram_manage_insights`
- Хугацаа: 1-2 долоо хоног
- Development дээр өөрийн test account-аар туршиж болно

---

## Дараагийн алхам

1. Meta App-д Instagram permissions нэмж тохируулах
2. DB migration бичих (Instagram account холболт)
3. Instagram OAuth flow хэрэгжүүлэх
4. Instagram metrics sync хийх
5. Dashboard-д FB + IG нэгтгэх
6. AI analysis-д cross-platform signal нэмэх
