import { ConfirmDialog } from '../../../components/ui/confirm-dialog';

/**
 * Investigation 삭제 Confirm — Search History와 동일 컴포넌트, 문구만 다름
 * (서버 soft-delete = Archived 전이)
 */
export function InvestigationDeleteDialog({
  open,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title="조사 삭제"
      variant="danger"
      confirmText="삭제"
      cancelText="취소"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="space-y-3">
        <p>이 Investigation를 삭제하시겠습니까?</p>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink-500">
            삭제되는 항목
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-ink-700">
            <li>Investigation</li>
            <li>Evidence</li>
            <li>AI 분석 결과</li>
            <li>이미지 비교 결과</li>
          </ul>
        </div>
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          이 작업은 되돌릴 수 없습니다.
        </p>
      </div>
    </ConfirmDialog>
  );
}
