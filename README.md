# InvestIQ - AI Investment Advisor

This app serves a data-driven investment advisor UI and reads generated artifacts from:

- `public/bootstrap.json`

The artifact is generated offline from local Yahoo-style Parquet datasets using:

- `../ml/build_artifacts.py`

## Project Layout

- `app/page.tsx` - hosts the advisor UI page
- `public/investment_advisor.html` - main interactive UI
- `app/api/chat/route.ts` - chat endpoint (fallback works without API key)
- `app/api/bootstrap/route.ts` - serves `bootstrap.json` reliably
- `../ml/build_artifacts.py` - offline model/data pipeline and artifact generator
- `../ml/requirements.txt` - Python dependencies for the ML pipeline

## What’s in `bootstrap.json` (for judges)

- **`companies`** — latest snapshot tickers, risk, rec, confidence, features, explainability
- **`evaluation`** — holdout accuracy, train accuracy, macro F1, Cohen’s κ, ROC-AUC (OVR), **weighted confusion cost**, train/test row counts
- **`meta`** — artifact version, UTC timestamp, **model ID** hash, data snapshot date, split cutoff, labeling summary, **limitations** list
- **`dataQuality`** — export count, training universe size, **% missing sector**, latest price date
- **`walkforward`** — train vs holdout accuracy bars (time-based split)
- **`calibration`** — binned mean confidence vs empirical accuracy on the holdout set (reliability diagram)
- **Models row** — macro **precision** / **recall** and **log loss** from sklearn on holdout

## Local Run

From this folder (`investiq`):

```bash
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

## Rebuild Artifacts From Dataset

From `investiq`:

```bash
npm run build:data
```

This runs:

```bash
python ../ml/build_artifacts.py --no_dividends --no_earnings --no_shap --max_symbols 500 --topk_latest_by_volume 150 --out investiq/public
```

Then restart dev server (`npm run dev`) or refresh browser.

## One Command Fresh Run

```bash
npm run dev:fresh
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import project in Vercel.
3. Framework preset: **Next.js**
4. Root Directory: **`.`** (if repo root is this `investiq` folder)
5. Deploy.

## Notes

- Keep large raw datasets (`*.parquet`, full CSV) out of GitHub/Vercel.
- Commit only generated small artifacts (for example `public/bootstrap.json`) and source code.

## Troubleshooting

### UI says JSON parse error / `NaN` in `bootstrap.json`

Python can write `NaN` into JSON, which **browsers cannot parse**. Regenerate after updating `ml/build_artifacts.py`, or repair an old file:

```bash
python ../ml/repair_bootstrap_json.py public/bootstrap.json
```

### “Same” SHAP bars for every ticker (`--no_shap`)

With `--no_shap`, the pipeline uses **global feature importances** (same for all rows). Remove `--no_shap` for per-ticker SHAP values (slower).
