import { Router, type Request, type Response, type NextFunction } from "express";
import {
  requestFromExpress,
  runWithRequestContext,
  type ApiResponse,
} from "@/lib/express-compat";
import * as login from "./growth/auth/login";
import * as logout from "./growth/auth/logout";
import * as passwordReset from "./growth/auth/password-reset";
import * as register from "./growth/auth/register";
import * as registerAccess from "./growth/auth/register/access";
import * as daily from "./growth/daily";
import * as goals from "./growth/goals";
import * as goal from "./growth/goals/[goalId]";
import * as permanentGoal from "./growth/goals/[goalId]/permanent";
import * as story from "./growth/story";
import * as registrationLink from "./growth/admin/registration-link";
import * as users from "./growth/admin/users";
import * as adminDaily from "./growth/admin/users/[userId]/daily";
import * as adminGoals from "./growth/admin/users/[userId]/goals";
import * as membership from "./growth/admin/users/[userId]/membership";
import * as resetLink from "./growth/admin/users/[userId]/password-reset";
import * as toggle from "./growth/admin/users/[userId]/toggle";
import * as read from "./growth/read";

type Endpoint = (request: ReturnType<typeof requestFromExpress>, context: { params: Promise<Record<string, string>> }) => Promise<ApiResponse>;

function endpoint(handler: Function) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const output = await runWithRequestContext(req, res, () =>
        handler(requestFromExpress(req), { params: Promise.resolve(req.params) }),
      ) as ApiResponse;
      for (const [name, value] of output.headers.entries()) res.setHeader(name, value);
      res.status(output.status).json(output.body);
    } catch (err) {
      req.log.error({ err }, "Growth Story API route failed");
      next(err);
    }
  };
}

const router = Router();

router.post("/auth/login", endpoint(login.POST));
router.post("/auth/logout", endpoint(logout.POST));
router.post("/auth/password-reset", endpoint(passwordReset.POST));
router.post("/auth/register", endpoint(register.POST));
router.post("/auth/register/access", endpoint(registerAccess.POST));
router.get("/home", endpoint(read.home));
router.get("/timeline", endpoint(read.timeline));
router.get("/daily", endpoint(daily.GET));
router.post("/daily", endpoint(daily.POST));
router.get("/goals", endpoint(goals.GET));
router.post("/goals", endpoint(goals.POST));
router.patch("/goals/:goalId", endpoint(goal.PATCH));
router.delete("/goals/:goalId", endpoint(goal.DELETE));
router.delete("/goals/:goalId/permanent", endpoint(permanentGoal.DELETE));
router.get("/story", endpoint(story.GET));
router.post("/story", endpoint(story.POST));
router.get("/story/history", endpoint(read.storyHistory));
router.get("/story/history/:versionId", endpoint(read.storyVersion));
router.get("/admin/registration-link", endpoint(registrationLink.GET));
router.get("/admin/users", endpoint(users.GET));
router.get("/admin/users/:userId", endpoint(read.adminUser));
router.get("/admin/users/:userId/daily", endpoint(adminDaily.GET));
router.get("/admin/users/:userId/daily/:date", endpoint(read.adminDailyDate));
router.get("/admin/users/:userId/goals", endpoint(adminGoals.GET));
router.get("/admin/users/:userId/story", endpoint(read.adminStory));
router.get("/admin/users/:userId/story/:versionId", endpoint(read.adminStoryVersion));
router.post("/admin/users/:userId/membership", endpoint(membership.POST));
router.post("/admin/users/:userId/password-reset", endpoint(resetLink.POST));
router.post("/admin/users/:userId/toggle", endpoint(toggle.POST));

export default router;