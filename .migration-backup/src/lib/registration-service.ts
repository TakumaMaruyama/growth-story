import { Prisma } from '@prisma/client';
import { GUARDIAN_CONSENT_NOTICE_VERSION } from './guardian-consent';
import { prisma } from './prisma';
import {
    normalizeAthleteRegistrationIdentity,
    normalizeAthleteRegistrationIdentityParts,
    normalizeStoredAthleteRegistrationIdentity,
} from './shared-registration';

export class AthleteAlreadyRegisteredError extends Error {
    constructor() {
        super('Athlete is already registered');
    }
}

export interface GuardianRegistrationInput {
    athleteFamilyName: string;
    athleteGivenName: string;
    loginId: string;
    passwordHash: string;
    guardianName: string;
    guardianRelationship: string;
}

export async function registerUserWithGuardianConsent(
    input: GuardianRegistrationInput,
    now = new Date(),
): Promise<{ id: string; role: 'USER'; displayName: string }> {
    const athleteIdentity = normalizeAthleteRegistrationIdentityParts(
        input.athleteFamilyName,
        input.athleteGivenName,
    );
    const legacyAthleteIdentity = normalizeAthleteRegistrationIdentity(
        `${input.athleteFamilyName}${input.athleteGivenName}`,
    );
    const legacyGivenNameIdentity = normalizeAthleteRegistrationIdentity(input.athleteGivenName);

    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(
                hashtextextended(${`registration-athlete:${athleteIdentity}`}, 0)
            )::text AS lock_result
        `;

        const existingMembers = await tx.user.findMany({
            where: { role: 'USER' },
            select: { displayName: true, familyName: true, givenName: true },
        });
        if (existingMembers.some((member) => {
            if (member.familyName && member.givenName) {
                return normalizeAthleteRegistrationIdentityParts(
                    member.familyName,
                    member.givenName,
                ) === athleteIdentity;
            }
            const legacyMemberIdentity = normalizeStoredAthleteRegistrationIdentity(member.displayName);
            return legacyMemberIdentity === legacyAthleteIdentity
                || legacyMemberIdentity === legacyGivenNameIdentity;
        })) {
            throw new AthleteAlreadyRegisteredError();
        }

        const user = await tx.user.create({
            data: {
                loginId: input.loginId,
                displayName: input.athleteGivenName,
                familyName: input.athleteFamilyName,
                givenName: input.athleteGivenName,
                passwordHash: input.passwordHash,
                role: 'USER',
                isActive: true,
                membershipStatus: 'ACTIVE',
                guardianConsent: {
                    create: {
                        guardianName: input.guardianName,
                        guardianRelationship: input.guardianRelationship,
                        noticeVersion: GUARDIAN_CONSENT_NOTICE_VERSION,
                        acceptedAt: now,
                    },
                },
            },
            select: { id: true, role: true, displayName: true },
        });

        return { id: user.id, role: 'USER' as const, displayName: user.displayName };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
