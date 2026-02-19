

# Commodity Prediction Page - Review & Enhancement Plan

## Current State Assessment

### What Works Well
- Clean, professional UI with 6-tab layout (Trade, Technical, Fundamental, Macro, Forecast, Scenarios)
- Good commodity selector with metals/energy categories and lot size info
- MCX trading hours banner
- International price correlation display
- Term structure card with futures curve visualization
- Data source badges (MCX Live, Yahoo Finance, AI Estimated)
- Quota tracking for free users

### Critical Issues Found

#### 1. Historical Data is Entirely Simulated
The `predict-commodity` edge function generates fake historical data using random walks (line 522):
```
const historicalData = generateHistoricalData(spotPrice, 200);
```
This means the price chart, all technical indicators (RSI, MACD, Bollinger Bands, etc.), and all support/resistance levels are based on **fabricated data**, not real market prices. This is the single biggest credibility problem.

**Fix:** Fetch real historical data from Yahoo Finance (like the stock prediction page does), using commodity-specific Yahoo symbols (e.g., `GC=F` for Gold, `SI=F` for Silver, `CL=F` for Crude Oil).

#### 2. Potential Runtime Crashes (`.toFixed()` on non-numbers)
The MacroFactorsCard and other components call `.toFixed()` directly on data values without type guards. If the macro/fundamentals API returns strings or undefined values, the page will crash -- the same `.toFixed()` bug that was already fixed on the options page.

**Fix:** Add `typeof === 'number'` guards across all commodity display components, similar to the options page fix.

#### 3. Term Structure Uses Random Values
The `generateTermStructure` function uses `Math.random()` to determine contango/backwardation spreads:
```
const spreadPct = isContango ? 0.3 + Math.random() * 0.5 : -0.2 - Math.random() * 0.3;
```
This means every prediction gives different term structure data, reducing credibility.

**Fix:** Calculate spread from actual near-month vs next-month futures prices fetched from Yahoo Finance.

#### 4. MCX Expiry Calendar is Limited
The hardcoded expiry calendar only covers dates through early 2026. It will need regular updates or a dynamic calculation fallback.

**Fix:** Extend the calendar and improve the fallback logic to be more accurate for dates beyond the calendar.

#### 5. Scenario Analysis Uses Fixed Volatility Factors
Scenarios use hardcoded volatility multipliers rather than deriving them from actual historical volatility or ATR.

**Fix:** Use the calculated ATR and historical volatility from real data to generate more accurate scenario targets.

---

## Implementation Plan

### Phase 1: Real Historical Data (High Priority)
- Update `predict-commodity/index.ts` to fetch real historical data from Yahoo Finance using commodity futures symbols
- Symbol mapping: GOLD -> GC=F, SILVER -> SI=F, CRUDEOIL -> CL=F, NATURALGAS -> NG=F, COPPER -> HG=F
- Convert USD prices to INR using the fetched USD/INR rate
- Fall back to simulated data only if Yahoo Finance fetch fails completely
- This single change will make all technical indicators, charts, and support/resistance levels real

### Phase 2: Type Safety Guards (High Priority)
- Add numeric type guards to `MacroFactorsCard.tsx` for all `.toFixed()` calls on macro data values (DXY, VIX, yields, USD/INR, etc.)
- Add guards to `CommodityPredictionDisplay.tsx` for prediction fields (entryPrice, greeks, etc.)
- Add guards to `TechnicalAnalysisCard.tsx` for all technical indicator displays
- Add guards to `PriceForecastCard.tsx` and `ScenarioAnalysisCard.tsx` for price/percentage displays
- Use pattern: `typeof value === 'number' ? value.toFixed(2) : '--'`

### Phase 3: Improved Term Structure (Medium Priority)
- Fetch near-month and next-month futures prices from Yahoo Finance
- Calculate actual contango/backwardation spread from real prices
- Remove `Math.random()` from term structure generation

### Phase 4: Dynamic Scenarios (Medium Priority)
- Use real ATR and historical volatility to calculate scenario targets
- Base best/worst case on actual 2-standard-deviation moves from historical data
- Make base case probability dynamic based on trend strength (ADX)

### Phase 5: Extended Expiry Calendar (Low Priority)
- Add 2026 Q2-Q4 expiry dates
- Improve fallback calculation for dates beyond the calendar
- Add validation to warn when using estimated expiry dates

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `supabase/functions/predict-commodity/index.ts` | Real Yahoo Finance data, improved term structure, dynamic scenarios | High |
| `src/components/commodity/MacroFactorsCard.tsx` | Type safety guards for all `.toFixed()` calls | High |
| `src/components/CommodityPredictionDisplay.tsx` | Type safety guards for prediction fields | High |
| `src/components/commodity/TechnicalAnalysisCard.tsx` | Type safety guards | High |
| `src/components/commodity/PriceForecastCard.tsx` | Type safety guards | High |
| `src/components/commodity/ScenarioAnalysisCard.tsx` | Type safety guards | High |
| `src/components/commodity/TermStructureCard.tsx` | Type safety guards | High |

