import { z } from "zod";
import { userService } from "../services/user.service";
import { signToken } from "../utils/jwt";
import { asyncHandler } from "../utils/asyncHandler";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(60),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateMeSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: "At least one of name or email must be provided",
  });

export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = registerSchema.parse(req.body);
  const user = await userService.register({ email, password, name });

  const token = signToken({ sub: user.id, email: user.email });
  res.status(201).json({ token, user });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await userService.verifyCredentials(email, password);

  const token = signToken({ sub: user.id, email: user.email });
  res.json({ token, user });
});

export const me = asyncHandler(async (req, res) => {
  const user = await userService.getById(req.userId!);
  res.json({ user });
});

export const updateMe = asyncHandler(async (req, res) => {
  const data = updateMeSchema.parse(req.body);
  const user = await userService.update(req.userId!, data);
  res.json({ user });
});
