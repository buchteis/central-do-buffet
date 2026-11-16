import {expect,test} from "vitest";
import {retryDelayMs} from "./groq.server";
test("delay",()=>{expect(retryDelayMs(new Response(""),"Please try again in 685.7ms")).toBeCloseTo(935.7,0);expect(retryDelayMs(new Response(""),"try again in 2s")).toBe(2250);});
