import { loggedInUser } from "#app/account";
import { BattleType } from "#app/battle";
import BattleScene from "#app/battle-scene";
import { fetchDailyRunSeed, getDailyRunStarters } from "#app/data/daily-run";
import { Gender } from "#app/data/gender";
import { getBiomeKey } from "#app/field/arena";
import { GameMode, GameModes, getGameMode } from "#app/game-mode";
import { Modifier } from "#app/modifier/modifier";
import { getDailyRunStarterModifiers, ModifierPoolType, modifierTypes, regenerateModifierPoolThresholds } from "#app/modifier/modifier-type";
import { Phase } from "#app/phase";
import { type SessionSaveData } from "#app/system/game-data";
import { Unlockables } from "#app/system/unlockables";
import { vouchers } from "#app/system/voucher";
import type { OptionSelectConfig, OptionSelectItem } from "#app/ui/abstact-option-select-ui-handler";
import { SaveSlotUiMode } from "#app/ui/save-slot-select-ui-handler";
import { Mode } from "#app/ui/ui";
import * as Utils from "#app/utils";
import i18next from "i18next";
import { CheckSwitchPhase } from "./check-switch-phase";
import { EncounterPhase } from "./encounter-phase";
import { SelectChallengePhase } from "./select-challenge-phase";
import { SelectStarterPhase } from "./select-starter-phase";
import { SummonPhase } from "./summon-phase";


export class TitlePhase extends Phase {
  private loaded: boolean;
  private lastSessionData: SessionSaveData;
  public gameMode: GameModes;

  constructor(scene: BattleScene) {
    super(scene);

    this.loaded = false;
  }

  start(): void {
    super.start();

    this.scene.ui.clearText();
    this.scene.ui.fadeIn(250);

    this.scene.playBgm("title", true);

    this.scene.gameData.getSession(loggedInUser?.lastSessionSlot ?? -1).then(sessionData => {
      if (sessionData) {
        this.lastSessionData = sessionData;
        const biomeKey = getBiomeKey(sessionData.arena.biome);
        const bgTexture = `${biomeKey}_bg`;
        this.scene.arenaBg.setTexture(bgTexture);
      }
      this.showOptions();
    }).catch(err => {
      console.error(err);
      this.showOptions();
    });
  }

  showOptions(): void {
    const options: OptionSelectItem[] = [];
    if (loggedInUser && loggedInUser.lastSessionSlot > -1) {
      options.push({
        label: i18next.t("continue", { ns: "menu" }),
        handler: () => {
          this.loadSaveSlot(this.lastSessionData || !loggedInUser ? -1 : loggedInUser.lastSessionSlot);
          return true;
        }
      });
    }
    options.push({
      label: i18next.t("menu:newGame"),
      handler: () => {
        const setModeAndEnd = (gameMode: GameModes) => {
          this.gameMode = gameMode;
          this.scene.ui.setMode(Mode.MESSAGE);
          this.scene.ui.clearText();
          this.end();
        };
        const { gameData } = this.scene;
        if (gameData.isUnlocked(Unlockables.ENDLESS_MODE)) {
          const options: OptionSelectItem[] = [
            {
              label: GameMode.getModeName(GameModes.CLASSIC),
              handler: () => {
                setModeAndEnd(GameModes.CLASSIC);
                return true;
              }
            },
            {
              label: GameMode.getModeName(GameModes.CHALLENGE),
              handler: () => {
                setModeAndEnd(GameModes.CHALLENGE);
                return true;
              }
            },
            {
              label: GameMode.getModeName(GameModes.ENDLESS),
              handler: () => {
                setModeAndEnd(GameModes.ENDLESS);
                return true;
              }
            }
          ];
          if (gameData.isUnlocked(Unlockables.SPLICED_ENDLESS_MODE)) {
            options.push({
              label: GameMode.getModeName(GameModes.SPLICED_ENDLESS),
              handler: () => {
                setModeAndEnd(GameModes.SPLICED_ENDLESS);
                return true;
              }
            });
          }
          options.push({
            label: i18next.t("menu:cancel"),
            handler: () => {
              this.scene.clearPhaseQueue();
              this.scene.pushPhase(new TitlePhase(this.scene));
              super.end();
              return true;
            }
          });
          this.scene.ui.showText(i18next.t("menu:selectGameMode"), null, () => this.scene.ui.setOverlayMode(Mode.OPTION_SELECT, { options: options }));
        } else {
          this.gameMode = GameModes.CLASSIC;
          this.scene.ui.setMode(Mode.MESSAGE);
          this.scene.ui.clearText();
          this.end();
        }
        return true;
      }
    },
    {
      label: i18next.t("menu:loadGame"),
      handler: () => {
        this.scene.ui.setOverlayMode(Mode.SAVE_SLOT, SaveSlotUiMode.LOAD,
          (slotId: integer) => {
            if (slotId === -1) {
              return this.showOptions();
            }
            this.loadSaveSlot(slotId);
          });
        return true;
      }
    },
    {
      label: i18next.t("menu:dailyRun"),
      handler: () => {
        this.initDailyRun();
        return true;
      },
      keepOpen: true
    },
    {
      label: i18next.t("menu:settings"),
      handler: () => {
        this.scene.ui.setOverlayMode(Mode.SETTINGS);
        return true;
      },
      keepOpen: true
    });
    const config: OptionSelectConfig = {
      options: options,
      noCancel: true,
      yOffset: 47
    };
    this.scene.ui.setMode(Mode.TITLE, config);
  }

  loadSaveSlot(slotId: integer): void {
    this.scene.sessionSlotId = slotId > -1 || !loggedInUser ? slotId : loggedInUser.lastSessionSlot;
    this.scene.ui.setMode(Mode.MESSAGE);
    this.scene.ui.resetModeChain();
    this.scene.gameData.loadSession(this.scene, slotId, slotId === -1 ? this.lastSessionData : undefined).then((success: boolean) => {
      if (success) {
        this.loaded = true;
        this.scene.ui.showText(i18next.t("menu:sessionSuccess"), null, () => this.end());
      } else {
        this.end();
      }
    }).catch(err => {
      console.error(err);
      this.scene.ui.showText(i18next.t("menu:failedToLoadSession"), null);
    });
  }

  initDailyRun(): void {
    this.scene.ui.setMode(Mode.SAVE_SLOT, SaveSlotUiMode.SAVE, (slotId: integer) => {
      this.scene.clearPhaseQueue();
      if (slotId === -1) {
        this.scene.pushPhase(new TitlePhase(this.scene));
        return super.end();
      }
      this.scene.sessionSlotId = slotId;

      const generateDaily = (seed: string) => {
        this.scene.gameMode = getGameMode(GameModes.DAILY);

        this.scene.setSeed(seed);
        this.scene.resetSeed(0);

        this.scene.money = this.scene.gameMode.getStartingMoney();

        const starters = getDailyRunStarters(this.scene, seed);
        const startingLevel = this.scene.gameMode.getStartingLevel();

        const party = this.scene.getPlayerParty();
        const loadPokemonAssets: Promise<void>[] = [];
        for (const starter of starters) {
          const starterProps = this.scene.gameData.getSpeciesDexAttrProps(starter.species, starter.dexAttr);
          const starterFormIndex = Math.min(starterProps.formIndex, Math.max(starter.species.forms.length - 1, 0));
          const starterGender = starter.species.malePercent !== null
            ? !starterProps.female ? Gender.MALE : Gender.FEMALE
            : Gender.GENDERLESS;
          const starterPokemon = this.scene.addPlayerPokemon(starter.species, startingLevel, starter.abilityIndex, starterFormIndex, starterGender, starterProps.shiny, starterProps.variant, undefined, starter.nature);
          starterPokemon.setVisible(false);
          party.push(starterPokemon);
          loadPokemonAssets.push(starterPokemon.loadAssets());
        }

        regenerateModifierPoolThresholds(party, ModifierPoolType.DAILY_STARTER);

        const modifiers: Modifier[] = Array(3).fill(null).map(() => modifierTypes.EXP_SHARE().withIdFromFunc(modifierTypes.EXP_SHARE).newModifier()!)
          .concat(Array(3).fill(null).map(() => modifierTypes.GOLDEN_EXP_CHARM().withIdFromFunc(modifierTypes.GOLDEN_EXP_CHARM).newModifier()!))
          .concat([ modifierTypes.MAP().withIdFromFunc(modifierTypes.MAP).newModifier()! ])
          .concat(getDailyRunStarterModifiers(party))
          .filter((m) => m !== null);

        for (const m of modifiers) {
          this.scene.addModifier(m, true, false, false, true);
        }
        this.scene.updateModifiers(true, true);

        Promise.all(loadPokemonAssets).then(() => {
          this.scene.time.delayedCall(500, () => this.scene.playBgm());
          this.scene.gameData.gameStats.dailyRunSessionsPlayed++;
          this.scene.newArena(this.scene.gameMode.getStartingBiome(this.scene));
          this.scene.newBattle();
          this.scene.arena.init();
          this.scene.sessionPlayTime = 0;
          this.scene.lastSavePlayTime = 0;
          this.end();
        });
      };

      // If Online, calls seed fetch from db to generate daily run. If Offline, generates a daily run based on current date.
      if (!Utils.isLocal || Utils.isLocalServerConnected) {
        fetchDailyRunSeed().then(seed => {
          if (seed) {
            generateDaily(seed);
          } else {
            throw new Error("Daily run seed is null!");
          }
        }).catch(err => {
          console.error("Failed to load daily run:\n", err);
        });
      } else {
        generateDaily(btoa(new Date().toISOString().substring(0, 10)));
      }
    });
  }

  end(): void {
    if (!this.loaded && !this.scene.gameMode.isDaily) {
      this.scene.arena.preloadBgm();
      this.scene.gameMode = getGameMode(this.gameMode);
      if (this.gameMode === GameModes.CHALLENGE) {
        this.scene.pushPhase(new SelectChallengePhase(this.scene));
      } else {
        this.scene.pushPhase(new SelectStarterPhase(this.scene));
      }
      this.scene.newArena(this.scene.gameMode.getStartingBiome(this.scene));
    } else {
      this.scene.playBgm();
    }

    this.scene.pushPhase(new EncounterPhase(this.scene, this.loaded));

    if (this.loaded) {
      const availablePartyMembers = this.scene.getPokemonAllowedInBattle().length;

      this.scene.pushPhase(new SummonPhase(this.scene, 0, true, true));
      if (this.scene.currentBattle.double && availablePartyMembers > 1) {
        this.scene.pushPhase(new SummonPhase(this.scene, 1, true, true));
      }

      if (this.scene.currentBattle.battleType !== BattleType.TRAINER && (this.scene.currentBattle.waveIndex > 1 || !this.scene.gameMode.isDaily)) {
        const minPartySize = this.scene.currentBattle.double ? 2 : 1;
        if (availablePartyMembers > minPartySize) {
          this.scene.pushPhase(new CheckSwitchPhase(this.scene, 0, this.scene.currentBattle.double));
          if (this.scene.currentBattle.double) {
            this.scene.pushPhase(new CheckSwitchPhase(this.scene, 1, this.scene.currentBattle.double));
          }
        }
      }
    }

    for (const achv of Object.keys(this.scene.gameData.achvUnlocks)) {
      if (vouchers.hasOwnProperty(achv) && achv !== "CLASSIC_VICTORY") {
        this.scene.validateVoucher(vouchers[achv]);
      }
    }

    super.end();
  }
}
