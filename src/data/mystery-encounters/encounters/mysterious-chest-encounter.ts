import BattleScene from "#app/battle-scene";
import MysteryEncounter, { MysteryEncounterBuilder } from "#app/data/mystery-encounters/mystery-encounter";
import { MysteryEncounterOptionBuilder } from "#app/data/mystery-encounters/mystery-encounter-option";
import { queueEncounterMessage, showEncounterText } from "#app/data/mystery-encounters/utils/encounter-dialogue-utils";
import { type EnemyPartyConfig, initBattleWithEnemyConfig, leaveEncounterWithoutBattle, setEncounterRewards, transitionMysteryEncounterIntroVisuals } from "#app/data/mystery-encounters/utils/encounter-phase-utils";
import { getHighestLevelPlayerPokemon, koPlayerPokemon } from "#app/data/mystery-encounters/utils/encounter-pokemon-utils";
import { getPokemonSpecies } from "#app/data/pokemon-species";
import { CLASSIC_MODE_MYSTERY_ENCOUNTER_WAVES } from "#app/game-mode";
import { ModifierTier } from "#app/modifier/modifier-tier";
import { GameOverPhase } from "#app/phases/game-over-phase";
import { randSeedInt } from "#app/utils";
import { Moves } from "#enums/moves";
import { MysteryEncounterOptionMode } from "#enums/mystery-encounter-option-mode";
import { MysteryEncounterTier } from "#enums/mystery-encounter-tier";
import { MysteryEncounterType } from "#enums/mystery-encounter-type";
import { Species } from "#enums/species";

/** i18n namespace for encounter */
const namespace = "mysteryEncounters/mysteriousChest";

const RAND_LENGTH = 100;
const TRAP_PERCENT = 35;
const COMMON_REWARDS_PERCENT = 20;
const ULTRA_REWARDS_PERCENT = 30;
const ROGUE_REWARDS_PERCENT = 10;
const MASTER_REWARDS_PERCENT = 5;

/**
 * Mysterious Chest encounter.
 * @see {@link https://github.com/pagefaultgames/pokerogue/issues/3796 | GitHub Issue #3796}
 * @see For biome requirements check {@linkcode mysteryEncountersByBiome}
 */
export const MysteriousChestEncounter: MysteryEncounter =
  MysteryEncounterBuilder.withEncounterType(MysteryEncounterType.MYSTERIOUS_CHEST)
    .withEncounterTier(MysteryEncounterTier.COMMON)
    .withSceneWaveRangeRequirement(...CLASSIC_MODE_MYSTERY_ENCOUNTER_WAVES)
    .withScenePartySizeRequirement(2, 6, true)
    .withAutoHideIntroVisuals(false)
    .withCatchAllowed(true)
    .withIntroSpriteConfigs([
      {
        spriteKey: "mysterious_chest_blue",
        fileRoot: "mystery-encounters",
        hasShadow: true,
        y: 8,
        yShadow: 6,
        alpha: 1,
        disableAnimation: true, // Re-enabled after option select
      },
      {
        spriteKey: "mysterious_chest_red",
        fileRoot: "mystery-encounters",
        hasShadow: false,
        y: 8,
        yShadow: 6,
        alpha: 0,
        disableAnimation: true, // Re-enabled after option select
      }
    ])
    .withIntroDialogue([
      {
        text: `${namespace}:intro`,
      }
    ])
    .setLocalizationKey(`${namespace}`)
    .withTitle(`${namespace}:title`)
    .withDescription(`${namespace}:description`)
    .withQuery(`${namespace}:query`)
    .withOnInit((scene: BattleScene) => {
      const encounter = scene.currentBattle.mysteryEncounter!;

      // Calculate boss mon
      const config: EnemyPartyConfig = {
        levelAdditiveModifier: 0.5,
        disableSwitch: true,
        pokemonConfigs: [
          {
            species: getPokemonSpecies(Species.GIMMIGHOUL),
            formIndex: 0,
            isBoss: true,
            moveSet: [ Moves.NASTY_PLOT, Moves.SHADOW_BALL, Moves.POWER_GEM, Moves.THIEF ]
          }
        ],
      };

      encounter.enemyPartyConfigs = [ config ];

      encounter.setDialogueToken("gimmighoulName", getPokemonSpecies(Species.GIMMIGHOUL).getName());
      encounter.setDialogueToken("trapPercent", TRAP_PERCENT.toString());
      encounter.setDialogueToken("commonPercent", COMMON_REWARDS_PERCENT.toString());
      encounter.setDialogueToken("ultraPercent", ULTRA_REWARDS_PERCENT.toString());
      encounter.setDialogueToken("roguePercent", ROGUE_REWARDS_PERCENT.toString());
      encounter.setDialogueToken("masterPercent", MASTER_REWARDS_PERCENT.toString());

      return true;
    })
    .withOption(
      MysteryEncounterOptionBuilder
        .newOptionWithMode(MysteryEncounterOptionMode.DEFAULT)
        .withDialogue({
          buttonLabel: `${namespace}:option.1.label`,
          buttonTooltip: `${namespace}:option.1.tooltip`,
          selected: [
            {
              text: `${namespace}:option.1.selected`,
            },
          ],
        })
        .withPreOptionPhase(async (scene: BattleScene) => {
          // Play animation
          const encounter = scene.currentBattle.mysteryEncounter!;
          const introVisuals = encounter.introVisuals!;

          // Determine roll first
          const roll = randSeedInt(RAND_LENGTH);
          encounter.misc = {
            roll
          };

          if (roll < TRAP_PERCENT) {
            // Chest is springing trap, change to red chest sprite
            const blueChestSprites = introVisuals.getSpriteAtIndex(0);
            const redChestSprites = introVisuals.getSpriteAtIndex(1);
            redChestSprites[0].setAlpha(1);
            blueChestSprites[0].setAlpha(0.001);
          }
          introVisuals.spriteConfigs[0].disableAnimation = false;
          introVisuals.spriteConfigs[1].disableAnimation = false;
          introVisuals.playAnim();
        })
        .withOptionPhase(async (scene: BattleScene) => {
          // Open the chest
          const encounter = scene.currentBattle.mysteryEncounter!;
          const roll = encounter.misc.roll;
          if (roll >= RAND_LENGTH - COMMON_REWARDS_PERCENT) {
            // Choose between 2 COMMON / 2 GREAT tier items (20%)
            setEncounterRewards(scene, {
              guaranteedModifierTiers: [
                ModifierTier.COMMON,
                ModifierTier.COMMON,
                ModifierTier.GREAT,
                ModifierTier.GREAT,
              ],
            });
            // Display result message then proceed to rewards
            queueEncounterMessage(scene, `${namespace}:option.1.normal`);
            leaveEncounterWithoutBattle(scene);
          } else if (roll >= RAND_LENGTH - COMMON_REWARDS_PERCENT - ULTRA_REWARDS_PERCENT) {
            // Choose between 3 ULTRA tier items (30%)
            setEncounterRewards(scene, {
              guaranteedModifierTiers: [
                ModifierTier.ULTRA,
                ModifierTier.ULTRA,
                ModifierTier.ULTRA,
              ],
            });
            // Display result message then proceed to rewards
            queueEncounterMessage(scene, `${namespace}:option.1.good`);
            leaveEncounterWithoutBattle(scene);
          } else if (roll >= RAND_LENGTH - COMMON_REWARDS_PERCENT - ULTRA_REWARDS_PERCENT - ROGUE_REWARDS_PERCENT) {
            // Choose between 2 ROGUE tier items (10%)
            setEncounterRewards(scene, { guaranteedModifierTiers: [ ModifierTier.ROGUE, ModifierTier.ROGUE ]});
            // Display result message then proceed to rewards
            queueEncounterMessage(scene, `${namespace}:option.1.great`);
            leaveEncounterWithoutBattle(scene);
          } else if (roll >= RAND_LENGTH - COMMON_REWARDS_PERCENT - ULTRA_REWARDS_PERCENT - ROGUE_REWARDS_PERCENT - MASTER_REWARDS_PERCENT) {
            // Choose 1 MASTER tier item (5%)
            setEncounterRewards(scene, { guaranteedModifierTiers: [ ModifierTier.MASTER ]});
            // Display result message then proceed to rewards
            queueEncounterMessage(scene, `${namespace}:option.1.amazing`);
            leaveEncounterWithoutBattle(scene);
          } else {
            // Your highest level unfainted Pokemon gets OHKO. Start battle against a Gimmighoul (35%)
            const highestLevelPokemon = getHighestLevelPlayerPokemon(scene, true, false);
            koPlayerPokemon(scene, highestLevelPokemon);

            encounter.setDialogueToken("pokeName", highestLevelPokemon.getNameToRender());
            await showEncounterText(scene, `${namespace}:option.1.bad`);

            // Handle game over edge case
            const allowedPokemon = scene.getPokemonAllowedInBattle();
            if (allowedPokemon.length === 0) {
              // If there are no longer any legal pokemon in the party, game over.
              scene.clearPhaseQueue();
              scene.unshiftPhase(new GameOverPhase(scene));
            } else {
              // Show which Pokemon was KOed, then start battle against Gimmighoul
              await transitionMysteryEncounterIntroVisuals(scene, true, true, 500);
              setEncounterRewards(scene, { fillRemaining: true });
              await initBattleWithEnemyConfig(scene, encounter.enemyPartyConfigs[0]);
            }
          }
        })
        .build()
    )
    .withSimpleOption(
      {
        buttonLabel: `${namespace}:option.2.label`,
        buttonTooltip: `${namespace}:option.2.tooltip`,
        selected: [
          {
            text: `${namespace}:option.2.selected`,
          },
        ],
      },
      async (scene: BattleScene) => {
        // Leave encounter with no rewards or exp
        leaveEncounterWithoutBattle(scene, true);
        return true;
      }
    )
    .build();
