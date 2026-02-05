import { readFileSync } from 'fs';
import { join } from 'path';
import { differenceInMonths, differenceInDays } from 'date-fns';

// KR coefficient types
interface KRCoefficient {
    intercept: number;
    height: number;
    weight: number;
    midParentHeight: number;
}

interface KRData {
    description: string;
    units: { height: string; weight: string };
    ageRange: { min: number; max: number };
    male: Record<string, KRCoefficient>;
    female: Record<string, KRCoefficient>;
}

// Load coefficients
let krData: KRData | null = null;

function loadKRCoefficients(): KRData {
    if (krData) return krData;
    const filePath = join(process.cwd(), 'src', 'data', 'kr_coeff.json');
    const content = readFileSync(filePath, 'utf-8');
    krData = JSON.parse(content) as KRData;
    return krData;
}

// Unit conversions
function cmToInches(cm: number): number {
    return cm / 2.54;
}

function inchesToCm(inches: number): number {
    return inches * 2.54;
}

function kgToLbs(kg: number): number {
    return kg * 2.20462;
}

// Calculate age in years with decimal
function calculateAge(birthDate: Date, measurementDate: Date): number {
    const years = differenceInMonths(measurementDate, birthDate) / 12;
    return Math.round(years * 2) / 2; // Round to nearest 0.5
}

// Find nearest age key in coefficients
function findNearestAgeKey(age: number, coefficients: Record<string, KRCoefficient>): string | null {
    const ages = Object.keys(coefficients).map(Number).sort((a, b) => a - b);
    if (ages.length === 0) return null;

    let nearest = ages[0];
    let minDiff = Math.abs(age - nearest);

    for (const a of ages) {
        const diff = Math.abs(age - a);
        if (diff < minDiff) {
            minDiff = diff;
            nearest = a;
        }
    }

    return nearest.toString();
}

export interface KRPredictionResult {
    predictedHeightCm: number;
    ageUsed: number;
    status: 'success';
}

export interface KRPredictionError {
    status: 'error';
    reason: 'missing_parent_height' | 'missing_weight' | 'age_out_of_range' | 'no_coefficients';
    message: string;
}

export type KRPrediction = KRPredictionResult | KRPredictionError;

/**
 * Predict adult height using Khamis-Roche method
 */
export function predictAdultHeight(params: {
    sex: 'MALE' | 'FEMALE';
    birthDate: Date;
    measurementDate: Date;
    heightCm: number;
    weightKg: number | null;
    fatherHeightCm: number | null;
    motherHeightCm: number | null;
}): KRPrediction {
    const { sex, birthDate, measurementDate, heightCm, weightKg, fatherHeightCm, motherHeightCm } = params;

    // Check required parent heights
    if (fatherHeightCm === null || motherHeightCm === null) {
        return {
            status: 'error',
            reason: 'missing_parent_height',
            message: '父母の身長が必要です',
        };
    }

    // Check weight
    if (weightKg === null) {
        return {
            status: 'error',
            reason: 'missing_weight',
            message: '体重が必要です',
        };
    }

    const data = loadKRCoefficients();
    const age = calculateAge(birthDate, measurementDate);

    // Check age range
    if (age < data.ageRange.min || age > data.ageRange.max) {
        return {
            status: 'error',
            reason: 'age_out_of_range',
            message: `年齢が対象範囲外です（${data.ageRange.min}〜${data.ageRange.max}歳）`,
        };
    }

    const coefficients = sex === 'MALE' ? data.male : data.female;
    const ageKey = findNearestAgeKey(age, coefficients);

    if (!ageKey || !coefficients[ageKey]) {
        return {
            status: 'error',
            reason: 'no_coefficients',
            message: '該当する係数がありません',
        };
    }

    const coef = coefficients[ageKey];

    // Convert to inches/lbs
    const heightIn = cmToInches(heightCm);
    const weightLbs = kgToLbs(weightKg);

    // Calculate mid-parent height (in inches)
    // For boys: (father + mother + 5) / 2
    // For girls: (father + mother - 5) / 2
    const fatherIn = cmToInches(fatherHeightCm);
    const motherIn = cmToInches(motherHeightCm);
    const midParentIn = sex === 'MALE'
        ? (fatherIn + motherIn + 5) / 2
        : (fatherIn + motherIn - 5) / 2;

    // KR formula: predictedHeight = intercept + height*H + weight*W + midParentHeight*MPH
    const predictedIn = coef.intercept +
        coef.height * heightIn +
        coef.weight * weightLbs +
        coef.midParentHeight * midParentIn;

    const predictedCm = inchesToCm(predictedIn);

    return {
        status: 'success',
        predictedHeightCm: Math.round(predictedCm * 10) / 10,
        ageUsed: parseFloat(ageKey),
    };
}

export interface PHVResult {
    status: 'success';
    phvDate: Date;
    phvVelocity: number; // cm per month
    message: string;
}

export interface PHVError {
    status: 'error';
    reason: 'insufficient_data';
    message: string;
}

export type PHVPrediction = PHVResult | PHVError;

/**
 * Estimate PHV (Peak Height Velocity) from measurement history
 */
export function estimatePHV(measurements: Array<{ measuredOn: Date; heightCm: number }>): PHVPrediction {
    // Need at least 3 measurements
    if (measurements.length < 3) {
        return {
            status: 'error',
            reason: 'insufficient_data',
            message: 'PHV推定には3回以上の測定が必要です',
        };
    }

    // Sort by date
    const sorted = [...measurements].sort((a, b) =>
        a.measuredOn.getTime() - b.measuredOn.getTime()
    );

    // Calculate velocity between each consecutive pair
    const velocities: Array<{
        midDate: Date;
        velocity: number; // cm per month
    }> = [];

    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const days = differenceInDays(curr.measuredOn, prev.measuredOn);
        if (days < 30) continue; // Skip if too close

        const heightDiff = curr.heightCm - prev.heightCm;
        const months = days / 30.44; // Average days per month
        const velocity = heightDiff / months;

        // Mid-point date
        const midTime = (prev.measuredOn.getTime() + curr.measuredOn.getTime()) / 2;
        velocities.push({
            midDate: new Date(midTime),
            velocity,
        });
    }

    if (velocities.length === 0) {
        return {
            status: 'error',
            reason: 'insufficient_data',
            message: '十分な期間の測定データがありません',
        };
    }

    // Find max velocity
    let maxVelocity = velocities[0];
    for (const v of velocities) {
        if (v.velocity > maxVelocity.velocity) {
            maxVelocity = v;
        }
    }

    return {
        status: 'success',
        phvDate: maxVelocity.midDate,
        phvVelocity: Math.round(maxVelocity.velocity * 100) / 100,
        message: 'この期間に最も成長速度が高かった可能性があります',
    };
}

// Extension point for Mirwald method (sitting height based)
// TODO: Implement Mirwald maturity offset calculation when sitting height data is available
// export function calculateMirwaldOffset(params: {...}): MirwaldResult { ... }
