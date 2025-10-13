export default () => ({
  port: (process.env.PORT, 10) || 4000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
});
