import BattleScene from "#app/battle-scene";
import { applyChallenges, ChallengeType } from "#app/data/challenge";
import { Gender } from "#app/data/gender";
import { SpeciesFormChangeMoveLearnedTrigger } from "#app/data/pokemon-forms";
import { getPokemonSpecies } from "#app/data/pokemon-species";
import { overrideHeldItems, overrideModifiers } from "#app/modifier/modifier";
import Overrides from "#app/overrides";
import { Phase } from "#app/phase";
import { TitlePhase } from "#app/phases/title-phase";
import { SaveSlotUiMode } from "#app/ui/save-slot-select-ui-handler";
import { type Starter } from "#app/ui/starter-select-ui-handler";
import { Mode } from "#app/ui/ui";
import { Species } from "#enums/species";
import SoundFade from "phaser3-rex-plugins/plugins/soundfade";

export class SelectStarterPhase extends Phase {

  constructor(scene: BattleScene) {
    super(scene);
  }

  start() {
    super.start();

    this.scene.playBgm("menu");

    this.scene.ui.setMode(Mode.STARTER_SELECT, (starters: Starter[]) => {
      this.scene.ui.clearText();
      this.scene.ui.setMode(Mode.SAVE_SLOT, SaveSlotUiMode.SAVE, (slotId: integer) => {
        if (slotId === -1) {
          this.scene.clearPhaseQueue();
          this.scene.pushPhase(new TitlePhase(this.scene));
          return this.end();
        }
        this.scene.sessionSlotId = slotId;
        this.initBattle(starters);
      });
    });
  }

  /**
   * Initialize starters before starting the first battle
   * @param starters {@linkcode Pokemon} with which to start the first battle
   */
  initBattle(starters: Starter[]) {
    const party = this.scene.getPlayerParty();
    const loadPokemonAssets: Promise<void>[] = [];
    starters.forEach((starter: Starter, i: integer) => {
      if (!i && Overrides.STARTER_SPECIES_OVERRIDE) {
        starter.species = getPokemonSpecies(Overrides.STARTER_SPECIES_OVERRIDE as Species);
      }
      const starterProps = this.scene.gameData.getSpeciesDexAttrProps(starter.species, starter.dexAttr);
      let starterFormIndex = Math.min(starterProps.formIndex, Math.max(starter.species.forms.length - 1, 0));
      if (
        starter.species.speciesId in Overrides.STARTER_FORM_OVERRIDES &&
        starter.species.forms[Overrides.STARTER_FORM_OVERRIDES[starter.species.speciesId]!]
      ) {
        starterFormIndex = Overrides.STARTER_FORM_OVERRIDES[starter.species.speciesId]!;
      }

      let starterGender = starter.species.malePercent !== null
        ? !starterProps.female ? Gender.MALE : Gender.FEMALE
        : Gender.GENDERLESS;
      if (Overrides.GENDER_OVERRIDE !== null) {
        starterGender = Overrides.GENDER_OVERRIDE;
      }
      const starterIvs = this.scene.gameData.dexData[starter.species.speciesId].ivs.slice(0);
      const starterPokemon = this.scene.addPlayerPokemon(starter.species, this.scene.gameMode.getStartingLevel(), starter.abilityIndex, starterFormIndex, starterGender, starterProps.shiny, starterProps.variant, starterIvs, starter.nature);
      starter.moveset && starterPokemon.tryPopulateMoveset(starter.moveset);
      if (starter.passive) {
        starterPokemon.passive = true;
      }
      starterPokemon.luck = this.scene.gameData.getDexAttrLuck(this.scene.gameData.dexData[starter.species.speciesId].caughtAttr);
      if (starter.pokerus) {
        starterPokemon.pokerus = true;
      }

      if (starter.nickname) {
        starterPokemon.nickname = starter.nickname;
      }

      if (this.scene.gameMode.isSplicedOnly || Overrides.STARTER_FUSION_OVERRIDE) {
        starterPokemon.generateFusionSpecies(true);
      }
      starterPokemon.setVisible(false);
      applyChallenges(this.scene.gameMode, ChallengeType.STARTER_MODIFY, starterPokemon);
      party.push(starterPokemon);
      loadPokemonAssets.push(starterPokemon.loadAssets());
    });
    overrideModifiers(this.scene);
    overrideHeldItems(this.scene, party[0]);
    Promise.all(loadPokemonAssets).then(() => {
      SoundFade.fadeOut(this.scene, this.scene.sound.get("menu"), 500, true);
      this.scene.time.delayedCall(500, () => this.scene.playBgm());
      if (this.scene.gameMode.isClassic) {
        this.scene.gameData.gameStats.classicSessionsPlayed++;
      } else {
        this.scene.gameData.gameStats.endlessSessionsPlayed++;
      }
      this.scene.newBattle();
      this.scene.arena.init();
      this.scene.sessionPlayTime = 0;
      this.scene.lastSavePlayTime = 0;
      // Ensures Keldeo (or any future Pokemon that have this type of form change) starts in the correct form
      this.scene.getPlayerParty().forEach((p) => {
        this.scene.triggerPokemonFormChange(p, SpeciesFormChangeMoveLearnedTrigger);
      });
      this.end();
    });
  }
}
