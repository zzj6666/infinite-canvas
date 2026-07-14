import { Settings2 } from "lucide-react";

import { AppConfigPanel } from "@/components/layout/app-config-modal";

export default function ConfigPage() {
    return (
        <main className="app-page h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
                <header className="border-b border-stone-300/70 pb-8 dark:border-stone-700/80">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-stone-500 dark:text-stone-400">
                        <Settings2 className="size-4" />
                        工作空间设置
                    </div>
                    <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-stone-950 sm:text-5xl dark:text-stone-100">配置与用户偏好</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 dark:text-stone-400">管理员统一维护 AI 渠道与模型范围，所有用户可在此查看自己的生成偏好。</p>
                </header>
                <div className="app-surface mt-7 rounded-2xl p-4 sm:p-6">
                    <AppConfigPanel />
                </div>
            </div>
        </main>
    );
}
