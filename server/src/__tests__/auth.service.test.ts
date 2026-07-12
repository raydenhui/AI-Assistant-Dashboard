// Mock modules before importing
jest.mock("jsonwebtoken");
jest.mock("../config/database", () => ({
	__esModule: true,
	default: {
		user: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
	},
}));
jest.mock("../config/google", () => ({
	createOAuth2Client: jest.fn(),
	getAuthUrl: jest.fn(),
	getTokensFromCode: jest.fn(),
	getGoogleUserInfo: jest.fn(),
	createAuthenticatedClient: jest.fn(),
	verifyAndRefreshTokens: jest.fn(),
	revokeTokens: jest.fn(),
}));
jest.mock("../config/index", () => ({
	config: {
		jwt: {
			secret: "test-jwt-secret",
			expiresIn: "7d",
		},
		llm: {
			openrouter: { apiKey: "key", defaultModel: "model", baseUrl: "url" },
			ollama: { defaultModel: "model", baseUrl: "url" },
		},
	},
}));

import jwt from "jsonwebtoken";
import prisma from "../config/database";
import {
	generateJwtToken,
	verifyJwtToken,
	getUserById,
	getUserByEmail,
	updateUserSettings,
} from "../services/auth.service";
import {
	UnauthorizedError,
	NotFoundError,
} from "../middleware/error.middleware";

const mockPrisma = prisma as any;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe("Auth Service", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("generateJwtToken", () => {
		it("should generate a JWT token for a user", () => {
			(mockJwt.sign as jest.Mock).mockReturnValue("test-token");
			const user = { id: "user-1", email: "test@example.com" };
			const result = generateJwtToken(user);

			expect(result.accessToken).toBe("test-token");
			expect(result.expiresIn).toBe("7d");
			expect(mockJwt.sign).toHaveBeenCalledWith(
				{ userId: "user-1", email: "test@example.com" },
				"test-jwt-secret",
				{ expiresIn: "7d" },
			);
		});
	});

	describe("verifyJwtToken", () => {
		it("should verify a valid token and return the payload", () => {
			const payload = { userId: "user-1", email: "test@example.com" };
			(mockJwt.verify as jest.Mock).mockReturnValue(payload);

			const result = verifyJwtToken("valid-token");
			expect(result).toEqual(payload);
		});

		it("should throw UnauthorizedError for expired token", () => {
			const error = new jwt.TokenExpiredError("jwt expired", new Date());
			(mockJwt.verify as jest.Mock).mockImplementation(() => {
				throw error;
			});

			expect(() => verifyJwtToken("expired-token")).toThrow(UnauthorizedError);
		});

		it("should throw UnauthorizedError for invalid token", () => {
			const error = new jwt.JsonWebTokenError("invalid");
			(mockJwt.verify as jest.Mock).mockImplementation(() => {
				throw error;
			});

			expect(() => verifyJwtToken("bad-token")).toThrow(UnauthorizedError);
		});
	});

	describe("getUserById", () => {
		it("should return user if found", async () => {
			const mockUser = { id: "user-1", email: "test@example.com" };
			mockPrisma.user.findUnique.mockResolvedValue(mockUser);

			const result = await getUserById("user-1");
			expect(result).toEqual(mockUser);
		});

		it("should throw NotFoundError if user not found", async () => {
			mockPrisma.user.findUnique.mockResolvedValue(null);
			await expect(getUserById("non-existent")).rejects.toThrow(NotFoundError);
		});
	});

	describe("getUserByEmail", () => {
		it("should return user if found by email", async () => {
			const mockUser = { id: "user-1", email: "test@example.com" };
			mockPrisma.user.findUnique.mockResolvedValue(mockUser);

			const result = await getUserByEmail("test@example.com");
			expect(result).toEqual(mockUser);
		});

		it("should return null if no user found by email", async () => {
			mockPrisma.user.findUnique.mockResolvedValue(null);
			const result = await getUserByEmail("unknown@example.com");
			expect(result).toBeNull();
		});
	});

	describe("updateUserSettings", () => {
		it("should update user llmProvider", async () => {
			const mockUser = { id: "user-1", llmProvider: "OLLAMA" };
			mockPrisma.user.update.mockResolvedValue(mockUser);

			const result = await updateUserSettings("user-1", {
				llmProvider: "OLLAMA",
			});
			expect(result).toEqual(mockUser);
			expect(mockPrisma.user.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "user-1" },
					data: expect.objectContaining({ llmProvider: "OLLAMA" }),
				}),
			);
		});

		it("should skip masked openRouterKey", async () => {
			const mockUser = { id: "user-1" };
			mockPrisma.user.update.mockResolvedValue(mockUser);

			await updateUserSettings("user-1", {
				openRouterKey: "\u2022\u2022\u2022\u2022key",
			});

			const callArgs = mockPrisma.user.update.mock.calls[0][0];
			expect(callArgs.data.openRouterKey).toBeUndefined();
		});
	});
});
