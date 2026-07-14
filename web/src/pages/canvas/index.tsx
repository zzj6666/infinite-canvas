import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "antd";
import { Plus } from "lucide-react";
import { CanvasDeleteProjectsDialog } from "@/components/canvas/canvas-delete-projects-dialog";
import { CanvasProjectCard } from "@/components/canvas/canvas-project-card";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { useCanvasUiStore } from "@/stores/canvas/use-canvas-ui-store";

export default function CanvasPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const autoOpenRef = useRef(false);
    const hydrated = useCanvasStore((state) => state.hydrated);
    const projects = useCanvasStore((state) => state.projects);
    const createProject = useCanvasStore((state) => state.createProject);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const setDeleteIds = useCanvasUiStore((state) => state.setDeleteProjectIds);

    const mode = searchParams.get("mode");
    const enterProject = (id: string) => {
        navigate(`/canvas/${id}`);
    };
    const createAndEnter = () => {
        void createProject(`无限画布 ${projects.length + 1}`).then((id) => enterProject(id));
    };
    useEffect(() => {
        if (!hydrated || autoOpenRef.current || (mode !== "new" && mode !== "recent")) return;
        autoOpenRef.current = true;
        void (async () => {
            if (mode === "recent" && projects[0]?.id) {
                enterProject(projects[0].id);
                return;
            }
            const id = await createProject(`无限画布 ${projects.length + 1}`);
            enterProject(id);
        })();
    }, [createProject, hydrated, mode, projects]);

    if (hydrated && (mode === "new" || mode === "recent")) return <main className="app-page flex h-full items-center justify-center text-sm text-stone-500">正在打开画布...</main>;

    return (
        <main className="app-page h-full overflow-auto text-stone-950 dark:text-stone-100">
            <div className="app-page-shell flex max-w-6xl flex-col gap-8">
                <header className="app-page-header flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs text-stone-500">画布库</p>
                        <h1 className="mt-3 text-3xl font-semibold">无限画布</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedIds.length ? (
                            <>
                                <Button disabled={!hydrated} onClick={() => setDeleteIds(selectedIds)}>
                                    删除选中
                                </Button>
                            </>
                        ) : null}
                        {projects.length ? (
                            <Button disabled={!hydrated} onClick={() => setDeleteIds(projects.map((project) => project.id))}>
                                删除全部
                            </Button>
                        ) : null}
                        <Button disabled={!hydrated} type="primary" icon={<Plus className="size-4" />} onClick={createAndEnter}>
                            新建画布
                        </Button>
                    </div>
                </header>

                {!hydrated ? (
                    <section className="app-surface flex min-h-[360px] items-center justify-center rounded-2xl text-sm text-stone-500">正在加载画布...</section>
                ) : projects.length ? (
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                        {projects.map((project) => (
                            <CanvasProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                ) : (
                    <section className="app-surface flex min-h-[360px] flex-col items-center justify-center rounded-2xl text-center">
                        <h2 className="text-xl font-medium">还没有画布</h2>
                        <p className="mt-3 text-sm text-stone-500">新建一个画布后，就可以独立保存节点、连线和画布外观。</p>
                        <Button type="primary" className="mt-6" icon={<Plus className="size-4" />} onClick={createAndEnter}>
                            新建画布
                        </Button>
                    </section>
                )}
            </div>

            <CanvasDeleteProjectsDialog />
        </main>
    );
}
