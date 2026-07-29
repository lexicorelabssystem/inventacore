const { z } = require("zod");

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

module.exports = { loginBody, changePasswordBody };
