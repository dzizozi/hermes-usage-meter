# Hermes Usage Meter

A tiny floating widget for **[Hermes Agent](https://github.com/NousResearch/hermes-agent) Desktop**
(Windows, macOS and Linux) that shows your model's real subscription quota as a living
Japanese rock garden fountain (*shishi-odoshi*).

![Usage meter preview](docs/rock-garden-preview.png)

[Animated demo](docs/rock-garden-demo.gif): butterflies visit, grass sways, and S descends gradually as you use your quota.

| Part | Meaning |
|---|---|
| **W** watercourse, carved in the rock | Remaining **weekly** quota. Water leaves from its top-left end into the bamboo |
| Glass bamboo | Time until the 5-hour session window resets, from the provider's real `resets_at` |
| **S** watercourse, in the ground | Remaining **session / 5-hour** quota. The level glides down gradually as you use it |

When the provider confirms a renewal, the bamboo tips and pours once into S, which fills up
to the new real balance.

Stones and wind-swayed grass line the S stream, and every 30 seconds one or two butterflies
come to rest on the grass and fly away.

## Honest data, no guesses

- Numbers come from Hermes itself (`model.options` and the focused session's token usage).
  The widget makes **no network calls of its own**, needs **no API key**, and stores nothing
  sensitive.
- Unknown stays unknown. It never shows a fake 0% or 100%, never converts tokens into a
  percentage, and never averages several accounts.
- A countdown reaching zero is **not** treated as a refill; the pour only happens after the
  provider reports a new reset time.
- Quota windows are available when your Hermes provider exposes them (for example
  OpenAI Codex and Anthropic Claude subscriptions over OAuth). Other providers still show the
  model and session tokens in the details panel, with quota marked as unavailable.

## Install

**Option 1: from inside Hermes (all platforms)**

Open **Plugins → Install from Git**, paste `dzizozi/hermes-usage-meter`, and confirm the
Desktop target.

**Option 2: Windows (PowerShell)**

```powershell
git clone https://github.com/dzizozi/hermes-usage-meter.git
cd hermes-usage-meter
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**Option 3: macOS / Linux**

```sh
git clone https://github.com/dzizozi/hermes-usage-meter.git
cd hermes-usage-meter
sh install.sh
```

The scripts copy `desktop/plugin.js` to `<HERMES_HOME>/desktop-plugins/hermes-usage-meter/`
(`%LOCALAPPDATA%\hermes` on Windows, `~/.hermes` elsewhere), keep a backup of any previous
version, and verify the copy. They honour `HERMES_HOME` for custom profiles. Hermes Desktop
picks the plugin up automatically; use **Plugins → Reload** if it doesn't appear.

To uninstall, delete that folder (or disable the plugin on the Plugins page).

## Using it

- **Drag** the drawing to move it; hover and drag the **bottom-right corner** to resize.
  Position and size are remembered.
- **Double-click** (or right-click, or press Enter) for details: model, provider, session
  tokens, every quota window and its reset time. Esc closes them.
- The widget lives in Hermes' base layer: previews, menus and dialogs always cover it, and it
  stays out of the way of their clicks.
- `prefers-reduced-motion` freezes all waves, grass and butterflies.

The interface text is currently in Arabic.

## Development

The tests reuse the dev dependencies already present in a Hermes Agent checkout
(esbuild, React, React Query, Playwright). Nothing is installed.

```sh
npm test               # 39 unit and fluid-physics tests (Node 20+)
npm run test:browser   # 33 real-browser scenarios with React + React Query
```

`HERMES_AGENT_DIR` points the browser test at a specific checkout. It tries Playwright's
Chromium, then Edge, then Chrome. All network data in the browser test is synthetic.

---

## بالعربية

ويدجيت صغيرة عائمة لتطبيق **Hermes Agent Desktop** على ويندوز وماك ولينكس. تعرض حصة
الاشتراك الحقيقية على شكل حديقة صخرية يابانية بنافورة خيزران:

- **W:** مجرى محفور في صخرة، يمثل الحصة الأسبوعية المتبقية، ويصب من طرفه الأيسر العلوي في القصبة.
- **القصبة الزجاجية:** الوقت المتبقي حتى تجدد نافذة الخمس ساعات، حسب موعد المزوّد الفعلي.
- **مجرى S:** مجرى في الأرض يمثل حصة الجلسة (5 ساعات)، وينخفض ماؤه تدريجيًا مع الاستخدام. حوله أحجار وحشائش تتمايل، وتزوره فراشة أو اثنتان كل 30 ثانية.

عند تأكيد المزوّد للتجدد، تنقلب القصبة وتسكب مرة واحدة في S.

لا تخمّن الويدجيت أي رقم: المجهول يبقى مجهولًا، ولا تتصل بالإنترنت ولا تحتاج مفتاح API.

**التثبيت:** من داخل Hermes افتح **Plugins → Install from Git** والصق
`dzizozi/hermes-usage-meter`. أو على ويندوز شغّل `install.ps1`، وعلى ماك أو لينكس شغّل
`install.sh`.

**الاستخدام:** اسحب الرسمة لتحريكها، واسحب الزاوية لتغيير حجمها، وانقر مرتين لعرض
التفاصيل.

## License

MIT
