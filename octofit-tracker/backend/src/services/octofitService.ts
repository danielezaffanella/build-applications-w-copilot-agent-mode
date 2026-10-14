import { Activity, Team, User, Workout } from '../models/index.js';
import { Types } from 'mongoose';

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!isRecord(input)) {
    throw badRequest('Activity details are required');
  }

  const { userId, teamId, type, minutes } = input;
  if (typeof userId !== 'string' || !/^[a-f\d]{24}$/i.test(userId)) {
    throw badRequest('A valid userId is required');
  }
  if (typeof teamId !== 'string' || !/^[a-f\d]{24}$/i.test(teamId)) {
    throw badRequest('A valid teamId is required');
  }
  if (typeof type !== 'string' || !type.trim()) {
    throw badRequest('An activity type is required');
  }
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    throw badRequest('Minutes must be a positive number');
  }

  const [user, team] = await Promise.all([
    User.exists({ _id: new Types.ObjectId(userId) }),
    Team.exists({ _id: new Types.ObjectId(teamId) }),
  ]);
  if (!user || !team) {
    throw badRequest('The specified user and team must exist');
  }

  return Activity.create({
    user: userId,
    team: teamId,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!isRecord(input)) {
    throw badRequest('Team details are required');
  }

  const { name, mascot, members = [] } = input;
  if (typeof name !== 'string' || !name.trim()) {
    throw badRequest('A team name is required');
  }
  if (typeof mascot !== 'string' || !mascot.trim()) {
    throw badRequest('A team mascot is required');
  }
  if (!Array.isArray(members) || members.some((member) => typeof member !== 'string' || !/^[a-f\d]{24}$/i.test(member))) {
    throw badRequest('Members must be an array of valid user IDs');
  }

  const memberIds = members.map((member) => new Types.ObjectId(member));
  const existingMembers = await User.countDocuments({ _id: { $in: memberIds } });
  if (existingMembers !== memberIds.length) {
    throw badRequest('All team members must exist');
  }

  return Team.create({ name: name.trim(), mascot: mascot.trim(), members: memberIds });
}

export async function getLeaderboard() {
  const [teams, activityTotals] = await Promise.all([
    Team.find().select('name').lean(),
    Activity.aggregate<{ _id: Types.ObjectId; totalPoints: number }>([
      { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    ]),
  ]);
  const pointsByTeam = new Map(activityTotals.map(({ _id, totalPoints }) => [_id.toString(), totalPoints]));

  return teams
    .map((team) => ({
      teamName: team.name,
      totalPoints: pointsByTeam.get(team._id.toString()) ?? 0,
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).select('fitnessGoal').lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const recentActivity = await Activity.findOne({ user: user._id }).sort({ occurredAt: -1 }).select('type').lean();
  const activityFocus: Record<string, string> = {
    run: 'endurance',
    cycle: 'endurance',
    strength: 'strength',
  };
  const focus = (recentActivity && activityFocus[recentActivity.type.toLowerCase()]) || user.fitnessGoal;
  const workouts = await Workout.find().lean();
  const matchingWorkouts = workouts.filter((workout) => workout.focus.toLowerCase() === focus.toLowerCase());
  const otherWorkouts = workouts.filter((workout) => workout.focus.toLowerCase() !== focus.toLowerCase());
  const reason = recentActivity
    ? `Recommended based on your recent ${recentActivity.type} activity.`
    : `Recommended to support your ${user.fitnessGoal} fitness goal.`;

  return [...matchingWorkouts, ...otherWorkouts].map((workout) => ({ ...workout, reason }));
}

export { User };
