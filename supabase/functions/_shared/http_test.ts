import { assertEquals } from "@std/assert";
import { escapeHtml, retryDelaySeconds, safeErrorCode } from "./http.ts";

Deno.test("safeErrorCode does not expose message contents", () => {
  assertEquals(
    safeErrorCode(new TypeError("child data must never be logged")),
    "TypeError",
  );
});

Deno.test("invitation HTML escapes untrusted household labels", () => {
  assertEquals(
    escapeHtml('<script>"Village" & friends</script>'),
    "&lt;script&gt;&quot;Village&quot; &amp; friends&lt;/script&gt;",
  );
});

Deno.test("delivery retry backoff is bounded", () => {
  assertEquals(retryDelaySeconds(1), 60);
  assertEquals(retryDelaySeconds(20), 3600);
});
