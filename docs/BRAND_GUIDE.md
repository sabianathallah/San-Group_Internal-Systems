# SAN Group — Dev Brand Guide

> **File ini adalah source of truth untuk semua frontend development.**
> Lampirkan file ini di SETIAP prompt yang involve UI/frontend.
> Tujuannya: output konsisten, profesional, dan TIDAK keliatan "buatan AI".

---

## 1. Brand Identity

| | |
|---|---|
| **Perusahaan** | SAN Group (Property Developer, est. 1998, Jakarta) |
| **Industri** | Property, Hospitality, Building Management |
| **Portofolio** | The Amboja, Hotel Oaktree, Oakwood properties, Antares Ballroom, dll. |
| **Tone** | Corporate-professional tapi approachable. Bukan startup playful, bukan juga kaku bank. Pikirkan *"property developer modern yang sudah matang."* |
| **Logo** | Angka "33" + teks "SAN GROUP" — monochrome, sans-serif, clean. |

**Logo hanya dalam 2 versi:** hitam di background putih, atau putih di background gelap.

---

## 2. Color Palette

### Primary Colors
```css
--color-primary:         #0F2942;   /* Navy deep — warna utama, sidebar, header */
--color-primary-light:   #1E4D6B;   /* Navy medium — hover, secondary surfaces */
--color-primary-lighter: #2D6A8F;   /* Navy soft — active states, borders */
--color-primary-50:      #E8F0F7;   /* Navy wash — background highlight */
```

### Neutral Colors
> Pakai ini banyak-banyak, bukan primary.

```css
--color-white:           #FFFFFF;
--color-gray-50:         #F9FAFB;   /* page background */
--color-gray-100:        #F3F4F6;   /* card background alternatif */
--color-gray-200:        #E5E7EB;   /* border default, divider */
--color-gray-300:        #D1D5DB;   /* border hover */
--color-gray-400:        #9CA3AF;   /* placeholder text */
--color-gray-500:        #6B7280;   /* secondary text */
--color-gray-600:        #4B5563;   /* body text */
--color-gray-700:        #374151;   /* heading text */
--color-gray-800:        #1F2937;   /* primary text */
--color-gray-900:        #111827;   /* darkest text */
```

### Semantic Colors
```css
--color-success:         #059669;   /* hijau — completed, active, online */
--color-success-light:   #D1FAE5;   /* background badge sukses */
--color-warning:         #D97706;   /* amber — pending, warning */
--color-warning-light:   #FEF3C7;
--color-danger:          #DC2626;   /* merah — error, urgent, overdue */
--color-danger-light:    #FEE2E2;
--color-info:            #2563EB;   /* biru — info, link, notification */
--color-info-light:      #DBEAFE;
```

### Accent
> Hemat. Hanya untuk highlight penting.

```css
--color-accent:          #C9A84C;   /* Gold muted — badge premium, label VIP */
--color-accent-light:    #F5EDDA;
```

### Aturan Warna

| | |
|---|---|
| ❌ | Jangan pakai gradient di background, card, atau button |
| ❌ | Jangan pakai warna neon atau saturated tinggi |
| ❌ | Jangan pakai lebih dari 2 warna selain gray di 1 halaman |
| ✅ | Dominasi gray + white, primary hanya di sidebar/header/accent |
| ✅ | Semantic color hanya untuk status (badge, icon, border-left) |
| ✅ | Rasio warna ideal per halaman: **70% neutral, 20% primary, 10% accent/semantic** |

---

## 3. Typography

### Font Stack
```css
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono:    'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

**Inter dipilih karena:**
- Bukan font default AI output (bukan system font, bukan Poppins, bukan DM Sans)
- Sangat readable di small size (tabel, form, dashboard)
- Ada variasi weight yang lengkap
- Umum di SaaS/enterprise app modern

### Size Scale
```css
--text-xs:    0.75rem;    /* 12px — caption, timestamp, helper text */
--text-sm:    0.8125rem;  /* 13px — table content, secondary info */
--text-base:  0.875rem;   /* 14px — body text DEFAULT, form label */
--text-md:    1rem;       /* 16px — card title, nav item */
--text-lg:    1.125rem;   /* 18px — section heading */
--text-xl:    1.25rem;    /* 20px — page title */
--text-2xl:   1.5rem;     /* 24px — dashboard metric number */
```

### Aturan Typography

| | |
|---|---|
| ❌ | Body text jangan 16px — terlalu besar untuk dashboard. Default **14px**. |
| ❌ | Jangan pakai font-weight 800 atau 900 (terlalu tebal, kesan "AI template") |
| ❌ | Jangan pakai ALL CAPS kecuali label badge status (max 2–3 kata) |
| ❌ | Jangan pakai letter-spacing yang terlalu wide |
| ✅ | Weight yang dipakai: **400** (normal), **500** (medium), **600** (semibold). Cukup 3 itu. |
| ✅ | Line-height body: **1.5–1.6** (bukan 1.75 yang terlalu spacious) |
| ✅ | Heading: weight 600, warna gray-800. Bukan bold 700, bukan hitam pekat. |

---

## 4. Spacing System

Base unit: **4px**

```css
--space-1:   4px;
--space-2:   8px;
--space-3:   12px;
--space-4:   16px;
--space-5:   20px;
--space-6:   24px;
--space-8:   32px;
--space-10:  40px;
--space-12:  48px;
```

### Aturan Spacing

| | |
|---|---|
| ❌ | Jangan terlalu spacious — ini dashboard operasional, bukan landing page |
| ❌ | Padding card: 16px–20px, **BUKAN** 32px atau 40px |
| ❌ | Gap antar card: 16px, **BUKAN** 24px atau 32px |
| ✅ | Compact tapi breathable — user butuh lihat banyak info sekaligus |
| ✅ | Sidebar width: **240px** (collapsed: 64px) |
| ✅ | Header height: **56px** |
| ✅ | Page content padding: **24px** |

---

## 5. Border & Radius

```css
--radius-sm:   4px;    /* badge, tag, small button */
--radius-md:   6px;    /* input, button, dropdown */
--radius-lg:   8px;    /* card, modal, dialog */
--radius-xl:   12px;   /* container besar, image preview */
```

### Aturan

| | |
|---|---|
| ❌ | Jangan pakai radius > 12px (keliatan "playful/startup") |
| ❌ | Jangan pakai `rounded-full` pada card atau container (hanya untuk avatar & badge dot) |
| ✅ | Border default: `1px solid gray-200` |
| ✅ | Border hover: `1px solid gray-300` |
| ✅ | Border focus (input): `1px solid primary` + ring `2px primary-50` |
| ✅ | Konsisten: kalau card pakai radius-lg (8px), semua card di halaman yang sama juga 8px |

---

## 6. Shadow

```css
--shadow-sm:  0 1px 2px 0 rgba(0,0,0,0.05);
--shadow-md:  0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px 0 rgba(0,0,0,0.04);
--shadow-lg:  0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04);
```

### Aturan

| | |
|---|---|
| ❌ | Jangan pakai shadow besar/dramatic — ini bukan landing page |
| ❌ | Jangan pakai colored shadow (shadow biru, shadow hijau, dll) |
| ✅ | Card: `shadow-sm` ATAU border. Pilih salah satu, **jangan dua-duanya**. |
| ✅ | Preferensi: **border > shadow** (lebih clean untuk dashboard) |
| ✅ | Shadow hanya untuk floating elements: dropdown, modal, popover, tooltip |

---

## 7. Component Conventions

### Sidebar
- Background: `primary` (#0F2942)
- Text: white, opacity 0.7 default → 1.0 saat active
- Active item: background `primary-light` + `border-left: 3px solid white` + text opacity 1.0
- Icon: Lucide, 20px, samping kiri teks
- Logo di top sidebar: putih, compact
- Divider antar section: `border-bottom: 1px solid rgba(255,255,255,0.1)`

### Header / Top Bar
- Background: white
- Border-bottom: `1px solid gray-200`
- Isi: breadcrumb (kiri), notification bell + user avatar dropdown (kanan)
- Jangan pakai search bar di header kecuali memang dibutuhkan

### Card
- Background: white
- Border: `1px solid gray-200`
- Radius: 8px
- Padding: 16px–20px
- Header card: teks 16px weight 600, gray-800
- ❌ Jangan pakai shadow + border sekaligus
- ❌ Jangan pakai background selain white (kecuali metric card)

### Metric / Stat Card
- Background: `gray-50` atau `primary-50`
- Angka besar: 24px weight 600
- Label: 12px weight 500, gray-500, UPPERCASE *(satu-satunya tempat uppercase boleh)*
- Trend indicator: panah atas hijau / panah bawah merah + persentase

### Button

| Variant | Style |
|---------|-------|
| **Primary** | bg `primary`, text white, hover `primary-light` |
| **Secondary** | bg white, border `gray-300`, text `gray-700`, hover `gray-50` |
| **Danger** | bg `danger`, text white — hanya untuk delete/destructive |
| **Ghost** | no border no bg, text `gray-600`, hover bg `gray-100` |

- Height: 36px (default) · 32px (compact/table) · 40px (prominent action)
- Radius: 6px
- ❌ Jangan gradient, shadow, atau `rounded-full` pada button (kecuali icon-only)

### Table
- Header: bg `gray-50`, teks 12px weight 600 gray-500, UPPERCASE
- Row: `border-bottom: 1px solid gray-200`
- Row hover: bg `gray-50`
- Cell padding: `12px 16px`
- ❌ Jangan zebra stripe — terlalu ramai

### Input / Form
- Height: 36px
- Border: `1px solid gray-300`
- Radius: 6px
- Padding horizontal: 12px
- Placeholder: gray-400
- Focus: border `primary`, ring `2px primary-50`
- Label: 14px weight 500, gray-700, margin-bottom 4px
- Error: border `danger`, teks `danger` 12px di bawah input

### Badge / Tag
- Padding: `2px 8px`
- Radius: 4px
- Font: 12px weight 500
- Warna selalu semantic:

| Status | Warna |
|--------|-------|
| OPEN / ACTIVE | info (biru) |
| PENDING / IN PROGRESS | warning (amber) |
| COMPLETED / RESOLVED | success (hijau) |
| URGENT / OVERDUE | danger (merah) |
| DRAFT / DEFAULT | gray |

### Empty State
- Icon: Lucide, 48px, gray-300
- Heading: 16px weight 500, gray-700
- Description: 14px gray-500
- CTA button (optional): secondary style
- Center aligned, padding 48px vertical

### Toast / Notification
- Position: top-right
- Radius: 8px
- Shadow: `shadow-md`
- Border-left: `3px solid` semantic color
- Auto dismiss: 5 detik

---

## 8. Layout Rules

### Page Structure
```
┌─────────────────────────────────────────────────┐
│  Sidebar (240px)  │  Header (56px)              │
│                   ├─────────────────────────────┤
│                   │  Page Content               │
│                   │  padding: 24px              │
│                   │                             │
│                   │                             │
└─────────────────────────────────────────────────┘
```

### Page Content Pattern
```
[Page Title — 20px weight 600]
[optional: subtitle — 14px gray-500]     [optional: action buttons — aligned kanan]

[filters / search bar — kalau ada]

[content area — cards, table, list]
```

### Responsive Breakpoints
```css
--bp-sm:   640px;   /* mobile */
--bp-md:   768px;   /* tablet — sidebar collapsed */
--bp-lg:  1024px;   /* desktop small — sidebar visible */
--bp-xl:  1280px;   /* desktop — full layout */
```

---

## 9. Icon Library

**Pakai: Lucide React** (`lucide-react`) — satu library, konsisten.

| Konteks | Size |
|---------|------|
| Inline text | 16px |
| Sidebar / nav | 20px |
| Page-level action | 24px |
| Empty state | 48px |

- Stroke width: **1.75** (default Lucide) — jangan diubah
- Color: inherit dari parent text color

| | |
|---|---|
| ❌ | Jangan campur library (Heroicons + Lucide + Phosphor) |
| ❌ | Jangan pakai emoji sebagai icon |
| ✅ | Satu library saja: **Lucide** |
| ✅ | Icon harus punya makna fungsional, bukan dekorasi |

---

## 10. Anti-Patterns — Yang Bikin "Keliatan AI"

Hindari semua ini. Ini ciri khas output AI yang harus dieliminasi:

| ❌ Anti-Pattern | Kenapa Dihindari |
|----------------|-----------------|
| Gradient background pada card, header, atau section | Keliatan template |
| Shadow yang terlalu dramatic (`shadow-xl`, `shadow-2xl`) | Tidak professional |
| Border-radius terlalu besar (`rounded-2xl`, `rounded-3xl`) | Playful, bukan corporate |
| Spacing terlalu lega (`gap-8`, `p-8` di mana-mana) | Landing page bukan dashboard |
| Terlalu banyak warna di 1 halaman (rainbow cards) | Tidak ada hierarchy |
| Semua heading pakai `font-bold` (800) | Keliatan template |
| Card dengan background warna-warni (biru, hijau, pink dalam 1 row) | Tidak professional |
| Hero section dengan text besar + gradient | Ini dashboard, bukan marketing page |
| Rounded avatar > 40px di card list | Terlalu dekoratif |
| Animasi/transition berlebihan (bounce, slide-in di semua element) | Distraksi |
| Terlalu banyak icon dekoratif yang tidak fungsional | Noise |
| Divider yang terlalu tebal atau berwarna | Mengganggu scan |
| Font Poppins, DM Sans, atau Outfit | Overused di AI output |
| Card grid 3-column simetris dengan icon + heading + description | Pattern paling umum AI |

### Yang Bikin Keliatan Profesional

| ✅ | Keterangan |
|----|-----------|
| **Dense tapi readable** | Informasi banyak tapi ga sesak |
| **Konsisten spacing & alignment** | Semua elemen "nyambung" |
| **Warna hemat** | Dominasi neutral, warna hanya untuk semantic meaning |
| **Typography hierarchy jelas tapi subtle** | Beda di weight & size, bukan di color dramatis |
| **Empty state informatif** | Bukan cuma "No data" |
| **Loading state: skeleton shimmer** | BUKAN spinner di tengah page |
| **Micro-detail** | Hover state, focus ring, transition 150ms ease |
| **Real-looking dummy data** | Nama Indo, tanggal realistis, angka masuk akal |

---

## 11. Cara Pakai File Ini di Prompt

Setiap kali membuat prompt frontend, tambahkan di awal:

```
Baca dan ikuti semua aturan di file BRAND_GUIDE.md yang ada di /docs/BRAND_GUIDE.md.
Jangan deviate dari color palette, typography, spacing, dan component conventions yang sudah didefinisikan.
Kalau ragu antara lebih colorful vs lebih neutral, SELALU pilih yang lebih neutral.
```

Ini akan memastikan semua output frontend konsisten dari halaman login sampai halaman terakhir.

---

*Last updated: Mei 2026 — SAN Group Internal Systems*
