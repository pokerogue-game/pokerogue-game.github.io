import { defineConfig } from 'astro/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { minifyJsonPlugin } from "#app/plugins/vite/vite-minify-json-plugin";
import type { Rollup } from 'vite';

// https://astro.build/config
export default defineConfig({
    site: 'https://pokerogue-game.github.io',
    base: 'pokerogue-game',
    vite: {
        plugins: [
            tsconfigPaths() as any, 
            minifyJsonPlugin(["images", "battle-anims"], true) as any
        ],
        clearScreen: false,
        appType: "mpa",
        build: {
            chunkSizeWarningLimit: 10000,
            minify: 'esbuild',
            sourcemap: false,
            manifest: true,
            rollupOptions: {
                onwarn(warning: Rollup.RollupLog, defaultHandler: (warning: string | Rollup.RollupLog) => void) {
                    // Suppress "Module level directives cause errors when bundled" warnings
                    if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
                        return;
                    }
                    defaultHandler(warning);
                },
            },
        },
    },
});
