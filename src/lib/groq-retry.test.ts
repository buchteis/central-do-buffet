import {expect,test} from "vitest";
import {retryDelayMs} from "./groq.server";
test("delay",()=>{expect(retryDelayMs(new Response(""),"Please try again in 685.7ms")).toBeCloseTo(935.7,0);expect(retryDelayMs(new Response(""),"try again in 2s")).toBe(2250);});
test("honors the longer Retry-After header without a 15-second clamp", () => {
  expect(retryDelayMs(new Response("", { headers: { "retry-after": "60" } }), "try again in 2s")).toBe(60250);
});
test("supports compound minute and second waits", () => {
  expect(retryDelayMs(new Response(""), "Please try again in 1m3.5s")).toBe(63750);
});
