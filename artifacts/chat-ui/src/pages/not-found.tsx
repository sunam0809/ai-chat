import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="text-xl text-foreground">페이지를 찾을 수 없습니다</p>
        <p className="text-muted-foreground">요청하신 페이지가 존재하지 않아요</p>
        <button
          onClick={() => setLocation("/")}
          className="mt-4 px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
