import { replay } from "./engine.js";
import { formatReport } from "./report.js";
import { ACCOUNTS, EVENTS, LAST_DAY } from "./scenario.js";

const result = replay(ACCOUNTS, EVENTS, LAST_DAY);
console.log(formatReport(result));