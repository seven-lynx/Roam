# Third-Party Notices

## Textures
- Material textures (metal, plastic, wood, leather) bundled in
  `android/app/src/main/res/drawable-nodpi/` are from **ambientCG**
  (https://ambientcg.com), licensed under **CC0 1.0 Universal (public domain)**.
  No attribution is required.

  Individual assets:
  - Metal009 (brushed metal)
  - Plastic006
  - Wood096
  - Leather037

## zeli-web-games

ROAM-OS ships a small set of in-device "programs" (web games) under
`web/src/components/programs/`. These are adapted from the open-source
**zeli-web-games** project and are redistributed under the Apache License 2.0.

- **Source:** https://github.com/hajunho/zeli-web-games
- **License:** Apache License 2.0 (SPDX: `Apache-2.0`)
- **Full license text:** https://www.apache.org/licenses/LICENSE-2.0

### Games used

| ROAM-OS program | zeli-web-games file | Modifications |
| --- | --- | --- |
| `RELAY` (snake) | `src/games/arcade/Snake.jsx` | Reskinned to the ROAM-OS palette; Korean labels replaced with English diegetic copy; refactored into TypeScript; added restart + keyboard scoping. |
| `BOTFIELD` (minesweeper) | `src/games/puzzle/Minesweeper.jsx` | Reskinned + relabeled; refactored into TypeScript; added restart. |
| `COMPILER` (tetris) | `src/games/arcade/MiniTetris.jsx` | Reskinned + relabeled; refactored into TypeScript; added restart + keyboard scoping. |
| `DEBRIS` (asteroids) | `src/games/arcade/Asteroids.jsx` | Reskinned + relabeled; refactored into TypeScript; added restart + keyboard scoping. |

### Apache License 2.0

The games are licensed under the Apache License 2.0. You may obtain a copy of
the license at https://www.apache.org/licenses/LICENSE-2.0.

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
