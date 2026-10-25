## Coordinates (polar, cylindrical, spherical)

Applies to `chalk-graph`, `chalk-vectors`, `chalk-draw` and `chalk-graph3d`. Every curve, point, vector and surface says which coordinate system its numbers are in with `"coords"` (default `"cartesian"`, so you can leave it off for cartesian items). The grid is chosen separately with `"grid"`. Mix freely: a polar curve on cartesian axes, a cartesian line on a polar grid.

- **Angles** are numbers in the spec's `"angleUnit"` (`"radians"`, the default, or `"degrees"`), or strings evaluated as math: `"pi/6"`, `"3*pi/4"`, `"30 deg"`. In degrees mode write plain numbers (`30`); a string containing `pi` is rejected there, because it would silently be read as degrees.
- **Expressions** (a curve's `r`, a surface's `z`/`r`/`rho`) are always in radians — `sin(theta)`, `cos(2*azimuth)`. `pi` and `e` are available.
- **Names.** 2D polar: `r`, `theta`. Cylindrical: `r`, `azimuth`, `z`. Spherical: `rho`, `polar` (angle down from +z, 0…π), `azimuth` (angle in the xy-plane from +x, 0…2π). These deliberately avoid θ/φ: physics (ISO) calls the polar angle θ and the azimuth φ, many maths texts swap them. In the spec always write `polar`/`azimuth`; when talking to the student use *their* convention and say which one it is.
- **Local basis vectors** are labelled with the physics letters: cylindrical r̂, φ̂, ẑ; spherical r̂, θ̂ (towards increasing polar angle), φ̂ (towards increasing azimuth). Point out the mapping if the student's book uses the other convention.
- **A polar grid** draws rings and spokes every π/6 (30°), labels angles around the border in the spec's `angleUnit`, and keeps one unit the same length on both axes so circles stay round.
- **Validation.** An item whose expression uses the wrong variables (a polar curve in `x`, a spherical surface in `theta`), or a local basis at the origin, is rejected with an error the student sees instead of the diagram. Check variable names against `coords` before emitting.

Physics recipes:
- Circular motion, central forces: `chalk-vectors` on a polar grid; the position as a `"polar"` vector, velocity/acceleration as `"polar-basis"` vectors at the particle (`tangential` speed; centripetal acceleration is `radial: -v²/r`).
- Fields of a point charge or line charge: `"polar-basis"` / `"spherical-basis"` / `"cylindrical-basis"` vectors with only a `radial` component.
- Radiation patterns, orbital shapes: a spherical surface `rho = f(polar, azimuth)` (a dipole is `rho = sin(polar)^2`).
- Gaussian surfaces: a sphere is `rho = R`; a cylinder is `r = R` (cylindrical, over `zDomain`).
