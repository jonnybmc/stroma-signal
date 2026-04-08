# Safari Manual Verification Checklist

Run this before calling the browser spike complete:

1. Load the spike lab in Safari.
2. Confirm a manual `flushNow()` produces:
   - one local collector payload
   - one preview URL
   - one `/r` report render
3. Confirm Safari emits nullable Chromium-only metrics:
   - `lcp_ms = null`
   - `cls = null`
   - `inp_ms = null`
   - `fcp_ms` and `ttfb_ms` populated
4. Confirm the report labels the selected race metric explicitly.
5. Confirm the proxy/CDN help text is visible and unambiguous.
