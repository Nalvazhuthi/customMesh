import { LineCurve3, QuadraticBezierCurve3, CurvePath, Vector3 } from "three";

export function generateRoundedPath(points: Vector3[], radius: number) {
    const path = new CurvePath<Vector3>();
    const curvatures: number[] = [0];
    let last = points[0].clone();

    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        const v1 = curr.clone().sub(prev).normalize();
        const v2 = next.clone().sub(curr).normalize();
        const angle = v1.angleTo(v2);
        const dist = Math.min(radius, curr.distanceTo(prev) * 0.45, curr.distanceTo(next) * 0.45);

        if (angle < 0.01 || dist < 0.001) {
            path.add(new LineCurve3(last, curr.clone()));
            curvatures.push(0);
            last = curr.clone();
            continue;
        }

        const p1 = curr.clone().sub(v1.multiplyScalar(dist));
        const p2 = curr.clone().add(v2.multiplyScalar(dist));
        path.add(new LineCurve3(last, p1));
        path.add(new QuadraticBezierCurve3(p1, curr.clone(), p2));
        curvatures.push(1 / dist);
        last = p2;
    }

    path.add(new LineCurve3(last, points[points.length - 1].clone()));
    curvatures.push(0);
    return { path, curvatures };
}