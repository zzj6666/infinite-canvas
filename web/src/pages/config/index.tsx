import { AppConfigPanel } from "@/components/layout/app-config-modal";

export default function ConfigPage() {
    return (
        <main className="app-page h-full overflow-y-auto">
            <div className="app-page-shell max-w-6xl">
                <div className="app-page-header">
                    <p className="text-xs font-medium tracking-wide text-stone-500 dark:text-stone-400">工作空间</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">配置与用户偏好</h1>
                    <p className="mt-2 text-sm text-stone-500">管理员配置全站 API 渠道；普通用户只需选择模型偏好</p>
                </div>
                <div className="app-surface rounded-2xl p-4 sm:p-6">
                    <AppConfigPanel />
                </div>
            </div>
        </main>
    );
}
