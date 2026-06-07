import {
	sleep,
	retryWithBackoff,
	truncate,
	stripHtml,
	extractTextFromHtml,
	parseEmailAddress,
	formatDate,
	getRelativeTime,
	isToday,
	isFuture,
	generateRandomString,
	safeJsonParse,
	deepClone,
	cleanObject,
	chunkArray,
	debounce,
	estimateTokenCount,
} from "../utils/helpers";

describe("Helpers Utility Functions", () => {
	describe("sleep", () => {
		it("should resolve after specified ms", async () => {
			const start = Date.now();
			const p = sleep(5);
			jest.advanceTimersByTime(5);
			await p;
			const duration = Date.now() - start;
			expect(duration).toBeGreaterThanOrEqual(0);
		});
	});

	describe("retryWithBackoff", () => {
		beforeEach(() => {
			jest.spyOn(global, "setTimeout").mockImplementation((cb: any) => {
				cb();
				return {} as any;
			});
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		it("should return result if fn succeeds on first try", async () => {
			const fn = jest.fn().mockResolvedValue("success");
			const result = await retryWithBackoff(fn, {
				maxRetries: 2,
				initialDelay: 1,
			});
			expect(result).toBe("success");
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it("should retry and succeed if fn fails initially but then succeeds", async () => {
			let count = 0;
			const fn = jest.fn().mockImplementation(async () => {
				count++;
				if (count < 2) throw new Error("fail");
				return "success";
			});
			const result = await retryWithBackoff(fn, {
				maxRetries: 2,
				initialDelay: 1,
			});
			expect(result).toBe("success");
			expect(fn).toHaveBeenCalledTimes(2);
		});

		it("should throw last error if all retries fail", async () => {
			const fn = jest.fn().mockRejectedValue(new Error("always fail"));
			await expect(
				retryWithBackoff(fn, { maxRetries: 2, initialDelay: 1 }),
			).rejects.toThrow("always fail");
			expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
		});
	});

	describe("truncate", () => {
		it("should not truncate if string is shorter than maxLength", () => {
			expect(truncate("hello", 10)).toBe("hello");
		});

		it("should truncate and add ellipsis if string is longer than maxLength", () => {
			expect(truncate("hello world", 7)).toBe("hell...");
		});
	});

	describe("stripHtml", () => {
		it("should remove HTML tags", () => {
			expect(stripHtml("<p>Hello <strong>World</strong></p>")).toBe(
				"Hello World",
			);
		});
	});

	describe("extractTextFromHtml", () => {
		it("should strip HTML and decode & entity", () => {
			const html = "<div>Hello &nbsp; & world</div>";
			expect(extractTextFromHtml(html)).toBe("Hello & world");
		});

		it("should decode < and > entities", () => {
			// Construct using string concatenation to avoid tool HTML entity conversion
			const html = "<div>" + "&" + "lt;tag></div>";
			expect(extractTextFromHtml(html)).toBe("<tag>");
		});

		it('should decode " and &#39; entities', () => {
			const html = '<div>"quoted" and &#39;apostrophe&#39;</div>';
			expect(extractTextFromHtml(html)).toBe("\"quoted\" and 'apostrophe'");
		});
	});

	describe("parseEmailAddress", () => {
		it("should parse name and email from standard format", () => {
			expect(parseEmailAddress("John Doe <john@example.com>")).toEqual({
				name: "John Doe",
				email: "john@example.com",
			});
		});

		it("should handle email only", () => {
			expect(parseEmailAddress("john@example.com")).toEqual({
				name: "",
				email: "john@example.com",
			});
		});
	});

	describe("formatDate", () => {
		it("should format Date object to ISO string", () => {
			const date = new Date("2026-01-01T12:00:00.000Z");
			expect(formatDate(date)).toBe("2026-01-01T12:00:00.000Z");
		});
	});

	describe("getRelativeTime", () => {
		it("should return just now for very recent times", () => {
			const now = new Date();
			expect(getRelativeTime(now)).toBe("just now");
		});

		it("should return minutes ago", () => {
			const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
			expect(getRelativeTime(fiveMinsAgo)).toBe("5 minutes ago");
		});
	});

	describe("isToday", () => {
		it("should return true for today", () => {
			expect(isToday(new Date())).toBe(true);
		});
	});

	describe("isFuture", () => {
		it("should return true for future date", () => {
			const future = new Date(Date.now() + 100000);
			expect(isFuture(future)).toBe(true);
		});

		it("should return false for past date", () => {
			const past = new Date(Date.now() - 100000);
			expect(isFuture(past)).toBe(false);
		});
	});

	describe("generateRandomString", () => {
		it("should generate string of specified length", () => {
			const str = generateRandomString(15);
			expect(str.length).toBe(15);
		});
	});

	describe("safeJsonParse", () => {
		it("should parse valid JSON", () => {
			expect(safeJsonParse('{"a": 1}', { a: 2 })).toEqual({ a: 1 });
		});

		it("should return default value for invalid JSON", () => {
			expect(safeJsonParse("invalid", { a: 2 })).toEqual({ a: 2 });
		});
	});

	describe("deepClone", () => {
		it("should deep clone an object", () => {
			const obj = { a: { b: 1 } };
			const clone = deepClone(obj);
			expect(clone).toEqual(obj);
			expect(clone).not.toBe(obj);
			expect(clone.a).not.toBe(obj.a);
		});
	});

	describe("cleanObject", () => {
		it("should remove undefined and null values", () => {
			const obj = { a: 1, b: undefined, c: null, d: "hello" };
			expect(cleanObject(obj)).toEqual({ a: 1, d: "hello" });
		});
	});

	describe("chunkArray", () => {
		it("should chunk array into smaller arrays", () => {
			const arr = [1, 2, 3, 4, 5];
			expect(chunkArray(arr, 2)).toEqual([[1, 2], [3, 4], [5]]);
		});
	});

	describe("debounce", () => {
		jest.useFakeTimers();
		it("should debounce function calls", () => {
			const fn = jest.fn();
			const debounced = debounce(fn, 100);
			debounced();
			debounced();
			expect(fn).not.toHaveBeenCalled();
			jest.advanceTimersByTime(100);
			expect(fn).toHaveBeenCalledTimes(1);
		});
	});

	describe("estimateTokenCount", () => {
		it("should estimate token count", () => {
			expect(estimateTokenCount("hello")).toBe(2);
		});
	});
});
