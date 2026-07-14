import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

const neutral = {
    light: {
        primary: "#292524",
        primaryHover: "#44403c",
        primaryText: "#fffdf9",
        background: "#f5f2ec",
        surface: "#fffdf9",
        border: "#ded8cd",
        menuBg: "#ebe7de",
        menuText: "#292524",
        selectActiveBg: "#f0ece4",
        selectSelectedBg: "#e7e2d8",
        selectText: "#292524",
        tableSelectedBg: "rgba(41, 37, 36, 0.05)",
        tableSelectedHoverBg: "rgba(41, 37, 36, 0.08)",
    },
    dark: {
        primary: "#f5f2ec",
        primaryHover: "#fffdf9",
        primaryText: "#211f1b",
        background: "#181715",
        surface: "#211f1b",
        border: "#3d3934",
        menuBg: "#2b2824",
        menuText: "#f5f2ec",
        selectActiveBg: "#2b2824",
        selectSelectedBg: "#34302b",
        selectText: "#f5f2ec",
        tableSelectedBg: "rgba(255, 255, 255, 0.08)",
        tableSelectedHoverBg: "rgba(255, 255, 255, 0.12)",
    },
};

export function getAntThemeConfig(dark: boolean): ThemeConfig {
    const color = dark ? neutral.dark : neutral.light;

    return {
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        cssVar: { key: dark ? "infinite-canvas-dark" : "infinite-canvas-light" },
        token: {
            colorPrimary: color.primary,
            colorInfo: color.primary,
            colorLink: color.primary,
            colorLinkHover: color.primaryHover,
            colorLinkActive: color.primary,
            colorTextLightSolid: color.primaryText,
            colorBgBase: color.background,
            colorBgContainer: color.surface,
            colorBgElevated: color.surface,
            colorBorder: color.border,
            colorBorderSecondary: color.border,
            borderRadius: 10,
            borderRadiusLG: 16,
        },
        components: {
            Button: {
                primaryShadow: "none",
            },
            Card: {
                boxShadowTertiary: "0 12px 32px rgba(41, 37, 36, 0.06)",
            },
            Menu: {
                itemActiveBg: color.menuBg,
                itemHoverBg: color.menuBg,
                itemSelectedBg: color.menuBg,
                itemSelectedColor: color.menuText,
                darkItemHoverBg: neutral.dark.menuBg,
                darkItemSelectedBg: neutral.dark.menuBg,
                darkItemSelectedColor: neutral.dark.menuText,
            },
            Select: {
                optionActiveBg: color.selectActiveBg,
                optionSelectedBg: color.selectSelectedBg,
                optionSelectedColor: color.selectText,
            },
            Table: {
                rowSelectedBg: color.tableSelectedBg,
                rowSelectedHoverBg: color.tableSelectedHoverBg,
            },
        },
    };
}
