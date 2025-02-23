import BattleScene from "#app/battle-scene";
import { BattlerIndex } from "#app/battle";
import { applyAbAttrs, applyPostDamageAbAttrs, BlockNonDirectDamageAbAttr, BlockStatusDamageAbAttr, PostDamageAbAttr, ReduceBurnDamageAbAttr } from "#app/data/ability";
import { CommonBattleAnim, CommonAnim } from "#app/data/battle-anims";
import { getStatusEffectActivationText } from "#app/data/status-effect";
import { BattleSpec } from "#app/enums/battle-spec";
import { StatusEffect } from "#app/enums/status-effect";
import { getPokemonNameWithAffix } from "#app/messages";
import * as Utils from "#app/utils";
import { PokemonPhase } from "./pokemon-phase";

export class PostTurnStatusEffectPhase extends PokemonPhase {
  constructor(scene: BattleScene, battlerIndex: BattlerIndex) {
    super(scene, battlerIndex);
  }

  start() {
    const pokemon = this.getPokemon();
    if (pokemon?.isActive(true) && pokemon.status && pokemon.status.isPostTurn() && !pokemon.switchOutStatus) {
      pokemon.status.incrementTurn();
      const cancelled = new Utils.BooleanHolder(false);
      applyAbAttrs(BlockNonDirectDamageAbAttr, pokemon, cancelled);
      applyAbAttrs(BlockStatusDamageAbAttr, pokemon, cancelled);

      if (!cancelled.value) {
        this.scene.queueMessage(getStatusEffectActivationText(pokemon.status.effect, getPokemonNameWithAffix(pokemon)));
        const damage = new Utils.NumberHolder(0);
        switch (pokemon.status.effect) {
          case StatusEffect.POISON:
            damage.value = Math.max(pokemon.getMaxHp() >> 3, 1);
            break;
          case StatusEffect.TOXIC:
            damage.value = Math.max(Math.floor((pokemon.getMaxHp() / 16) * pokemon.status.toxicTurnCount), 1);
            break;
          case StatusEffect.BURN:
            damage.value = Math.max(pokemon.getMaxHp() >> 4, 1);
            applyAbAttrs(ReduceBurnDamageAbAttr, pokemon, null, false, damage);
            break;
        }
        if (damage.value) {
          // Set preventEndure flag to avoid pokemon surviving thanks to focus band, sturdy, endure ...
          this.scene.damageNumberHandler.add(this.getPokemon(), pokemon.damage(damage.value, false, true));
          pokemon.updateInfo();
          applyPostDamageAbAttrs(PostDamageAbAttr, pokemon, damage.value, pokemon.hasPassive(), false, []);
        }
        new CommonBattleAnim(CommonAnim.POISON + (pokemon.status.effect - 1), pokemon).play(this.scene, false, () => this.end());
      } else {
        this.end();
      }
    } else {
      this.end();
    }
  }

  override end() {
    if (this.scene.currentBattle.battleSpec === BattleSpec.FINAL_BOSS) {
      this.scene.initFinalBossPhaseTwo(this.getPokemon());
    } else {
      super.end();
    }
  }
}
