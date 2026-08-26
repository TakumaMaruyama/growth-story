import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { jsonResponse } from "@/lib/request";
import { parseDateOnly, todayJST } from "@/lib/date";
import { getJSTDateTimeRange, getRecordCalendarDateRange, parseRecordSearchParams } from "@/lib/records";
import { loadRecordCalendarRows, loadRecordListPageRows } from "@/lib/record-query";
import { serializeAdminTargetUser } from "@/lib/user-name";
import type { NextRequest } from "@/lib/express-compat";

function member(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return jsonResponse({ error: "認証が必要です" }, 401);
  if (user.role !== "USER") return jsonResponse({ error: "この機能は選手専用です" }, 403);
  return null;
}
function isMember(user: Awaited<ReturnType<typeof getCurrentUser>>): user is NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> {
  return user !== null && user.role === "USER";
}
function admin(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return jsonResponse({ error: "認証が必要です" }, 401);
  if (user.role !== "ADMIN") return jsonResponse({ error: "権限がありません" }, 403);
  return null;
}
const memberShape = (user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => ({
  id: user.id, displayName: user.displayName, membershipStatus: user.membershipStatus,
});
const storyContent = (answers: Array<{ questionNo: number; answerText: string }>) =>
  answers.sort((a, b) => a.questionNo - b.questionNo).map((answer) => answer.answerText).join("\n\n");

export async function home() {
  const user = await getCurrentUser(); if (!isMember(user)) return member(user);
  const today = parseDateOnly(todayJST())!;
  try {
    const [todayLog, latestStory, dailyLogCount, storyVersionCount, competitionGoals] = await Promise.all([
      prisma.dailyLog.findUnique({ where: { userId_logDate: { userId: user.id, logDate: today } }, select: { score: true, activityType: true, goodText: true } }),
      prisma.storyVersion.findFirst({ where: { userId: user.id }, orderBy: { version: "desc" }, select: { version: true, createdAt: true } }),
      prisma.dailyLog.count({ where: { userId: user.id } }),
      prisma.storyVersion.count({ where: { userId: user.id } }),
      prisma.competitionGoal.findMany({ where: { userId: user.id, isActive: true }, orderBy: { updatedAt: "desc" } }),
    ]);
    return jsonResponse({ user: memberShape(user), todayLog, latestStory, dailyLogCount, storyVersionCount, competitionGoals });
  } catch (err) { return jsonResponse({ error: "ホームを読み込めませんでした" }, 500); }
}

export async function timeline(request: NextRequest) {
  const user = await getCurrentUser(); if (!isMember(user)) return member(user);
  try {
    const state = parseRecordSearchParams(Object.fromEntries(request.nextUrl.searchParams), todayJST());
    if (state.view === "calendar") {
      const range = getRecordCalendarDateRange(state.month);
      const instantRange = getJSTDateTimeRange(range.startKey, range.endKey);
      const rows = await loadRecordCalendarRows(user.id, state.type, {
        dateStart: range.start, dateEnd: range.end,
        instantStart: instantRange.start, instantEnd: instantRange.end,
      });
      const items = [
        ...rows.dailyLogs.map((row) => ({ ...row, type: "daily" })),
        ...rows.goals.map((row) => ({ ...row, type: "goal" })),
        ...rows.stories.map((row) => ({ ...row, type: "story" })),
      ];
      return jsonResponse({ user: memberShape(user), isReadOnly: user.membershipStatus === "WITHDRAWN", calendarData: { items, undatedGoalCount: rows.undatedGoalCount }, listPage: null });
    }
    const page = await loadRecordListPageRows(user.id, state.type, state.page, 30);
    const items = page.rows.map((row) => row.itemType === "daily"
      ? { id: row.recordId, type: "daily", logDate: row.dateKey, score: row.score, activityType: row.activityType }
      : row.itemType === "goal"
        ? { id: row.recordId, type: "goal", goalType: row.goalType, title: row.title, details: row.details, targetDate: row.targetDate, isActive: row.isActive, archivedAt: row.archivedAt, updatedAt: row.updatedAt }
        : { id: row.recordId, type: "story", version: row.version, note: row.note, createdAt: row.sortTime });
    return jsonResponse({ user: memberShape(user), isReadOnly: user.membershipStatus === "WITHDRAWN", calendarData: null, listPage: { items, totalItems: page.totalItems } });
  } catch (err) { request.log.error({ err }, "Timeline read error"); return jsonResponse({ error: "記録を読み込めませんでした" }, 500); }
}

export async function storyHistory() {
  const user = await getCurrentUser(); if (!isMember(user)) return member(user);
  const versions = await prisma.storyVersion.findMany({ where: { userId: user.id }, orderBy: { version: "desc" }, select: { id: true, version: true, note: true, createdAt: true } });
  return jsonResponse({ user: memberShape(user), latestStory: versions[0] ?? null, versions, isReadOnly: user.membershipStatus === "WITHDRAWN" });
}
export async function storyVersion(_request: NextRequest, { params }: { params: Promise<Record<string, string>> }) {
  const user = await getCurrentUser(); if (!isMember(user)) return member(user);
  const { versionId } = await params;
  const version = await prisma.storyVersion.findFirst({ where: { id: versionId, userId: user.id }, include: { answers: { orderBy: { questionNo: "asc" } } } });
  if (!version) return jsonResponse({ error: "物語が見つかりません" }, 404);
  return jsonResponse({ user: memberShape(user), story: { id: version.id, version: version.version, note: version.note, createdAt: version.createdAt, content: storyContent(version.answers) } });
}

async function target(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, loginId: true, displayName: true, familyName: true, givenName: true, membershipStatus: true, isActive: true, createdAt: true } });
}
export async function adminUser(_request: NextRequest, { params }: { params: Promise<Record<string, string>> }) {
  const current = await getCurrentUser(); const denied = admin(current); if (denied) return denied;
  const { userId } = await params; const targetUser = await target(userId);
  if (!targetUser) return jsonResponse({ error: "ユーザーが見つかりません" }, 404);
  const [latestStory, latestLog, activeGoalsCount] = await Promise.all([
    prisma.storyVersion.findFirst({ where: { userId }, orderBy: { version: "desc" }, select: { version: true, createdAt: true } }),
    prisma.dailyLog.findFirst({ where: { userId }, orderBy: { logDate: "desc" }, select: { logDate: true, score: true, activityType: true } }),
    prisma.competitionGoal.count({ where: { userId, isActive: true } }),
  ]);
  return jsonResponse({ targetUser, latestStory, latestLog, activeGoalsCount });
}
export async function adminDailyDate(_request: NextRequest, { params }: { params: Promise<Record<string, string>> }) {
  const current = await getCurrentUser(); const denied = admin(current); if (denied) return denied;
  const { userId, date } = await params; const logDate = parseDateOnly(date);
  if (!logDate) return jsonResponse({ error: "日誌が見つかりません" }, 404);
  const [targetUser, log] = await Promise.all([target(userId), prisma.dailyLog.findUnique({ where: { userId_logDate: { userId, logDate } }, select: { score: true, activityType: true, goodText: true, improveText: true, tomorrowText: true } })]);
  if (!targetUser) return jsonResponse({ error: "ユーザーが見つかりません" }, 404);
  return jsonResponse({ targetUser: serializeAdminTargetUser(targetUser), log });
}
export async function adminStory(_request: NextRequest, { params }: { params: Promise<Record<string, string>> }) {
  const current = await getCurrentUser(); const denied = admin(current); if (denied) return denied;
  const { userId } = await params; const targetUser = await target(userId);
  if (!targetUser) return jsonResponse({ error: "ユーザーが見つかりません" }, 404);
  const versions = await prisma.storyVersion.findMany({ where: { userId }, orderBy: { version: "desc" }, select: { id: true, version: true, note: true, createdAt: true } });
  return jsonResponse({ targetUser: serializeAdminTargetUser(targetUser), versions });
}
export async function adminStoryVersion(_request: NextRequest, { params }: { params: Promise<Record<string, string>> }) {
  const current = await getCurrentUser(); const denied = admin(current); if (denied) return denied;
  const { userId, versionId } = await params; const targetUser = await target(userId);
  if (!targetUser) return jsonResponse({ error: "ユーザーが見つかりません" }, 404);
  const version = await prisma.storyVersion.findFirst({ where: { id: versionId, userId }, include: { answers: { orderBy: { questionNo: "asc" } } } });
  if (!version) return jsonResponse({ error: "物語が見つかりません" }, 404);
  return jsonResponse({ targetUser: serializeAdminTargetUser(targetUser), story: { id: version.id, version: version.version, note: version.note, createdAt: version.createdAt, content: storyContent(version.answers) } });
}