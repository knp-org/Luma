# Pinned UI package

`knp-org-liquid-glass-ui-1.0.8.tgz` contains the built npm distribution of
`@knp-org/liquid-glass-ui` 1.0.8 from commit
`6de1054c4e3d328e1584f0bc24b9de99c7d04cca` in
https://github.com/knp-org/liquid-glass-ui.

SHA-256: `b16ed20de7f105c219d173d433bc6da8970c288b0bf5d11ca7861745017d224c`

The upstream AGPL-3.0 license and source maps are included in the archive.
The package is vendored so fresh installs and CI use the same UI without a
private checkout, credentials, or changes in a sibling directory.

To update, check out a reviewed upstream commit, build and pack it, replace this
archive, update this provenance record and package.json, then run npm install
and the frontend checks. Commit the resulting lockfile together with the archive.
