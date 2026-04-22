# Ví dụ React: Quản lý dữ liệu 5 bước + lịch sử riêng từng bước

Ví dụ này giải quyết đồng thời:

1. Chuyển bước không mất dữ liệu đã nhập.
2. Mỗi bước có lịch sử riêng, chọn lịch sử bước nào chỉ cập nhật bước đó.

## Component đầy đủ

```tsx
import React, { useMemo, useState } from 'react';

type StepKey = 'step1' | 'step2' | 'step3' | 'step4' | 'step5';
const STEPS: StepKey[] = ['step1', 'step2', 'step3', 'step4', 'step5'];

type StepForm = {
  fullName?: string;
  address?: string;
  note?: string;
};

type HistoryItem = {
  id: string;
  at: string; // ISO datetime
  version: number;
  data: StepForm;
  action: 'save' | 'complete';
};

type WizardState = {
  currentStep: StepKey;
  // Dữ liệu hiện tại của từng bước (tách riêng)
  current: Record<StepKey, StepForm>;
  // Lịch sử của từng bước (tách riêng)
  history: Record<StepKey, HistoryItem[]>;
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function makeInitialState(): WizardState {
  return {
    currentStep: 'step1',
    current: {
      step1: { fullName: '' },
      step2: { address: '' },
      step3: { note: '' },
      step4: { note: '' },
      step5: { note: '' },
    },
    history: {
      step1: [],
      step2: [],
      step3: [],
      step4: [],
      step5: [],
    },
  };
}

export default function FiveStepWizard() {
  const [state, setState] = useState<WizardState>(() => makeInitialState());

  const activeStep = state.currentStep;
  const activeData = state.current[activeStep];
  const activeHistory = state.history[activeStep];

  const stepLabel = useMemo(
    () => ({
      step1: 'Bước 1',
      step2: 'Bước 2',
      step3: 'Bước 3',
      step4: 'Bước 4',
      step5: 'Bước 5',
    }),
    []
  );

  // Đổi bước: chỉ đổi con trỏ currentStep, KHÔNG reset current
  const goToStep = (step: StepKey) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  };

  // Cập nhật field của bước hiện tại: chỉ chạm current[step hiện tại]
  const updateField = (field: keyof StepForm, value: string) => {
    setState((prev) => {
      const step = prev.currentStep;
      return {
        ...prev,
        current: {
          ...prev.current,
          [step]: {
            ...prev.current[step],
            [field]: value,
          },
        },
      };
    });
  };

  // Tạo snapshot lịch sử cho đúng bước hiện tại
  const pushHistory = (action: 'save' | 'complete') => {
    setState((prev) => {
      const step = prev.currentStep;
      const dataSnapshot = deepClone(prev.current[step]);
      const stepHistory = prev.history[step];

      const item: HistoryItem = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        version: stepHistory.length + 1,
        data: dataSnapshot,
        action,
      };

      return {
        ...prev,
        history: {
          ...prev.history,
          [step]: [item, ...stepHistory], // newest first
        },
      };
    });
  };

  // Chọn 1 item lịch sử của bước X: chỉ cập nhật current[X]
  const restoreHistoryForStep = (step: StepKey, historyId: string) => {
    setState((prev) => {
      const item = prev.history[step].find((h) => h.id === historyId);
      if (!item) return prev;

      return {
        ...prev,
        current: {
          ...prev.current,
          [step]: deepClone(item.data),
        },
      };
    });
  };

  // Ví dụ complete: lưu snapshot rồi nhảy bước kế
  const completeStep = () => {
    setState((prev) => {
      const step = prev.currentStep;
      const snapshot: HistoryItem = {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        version: prev.history[step].length + 1,
        data: deepClone(prev.current[step]),
        action: 'complete',
      };

      const nextIndex = Math.min(STEPS.indexOf(step) + 1, STEPS.length - 1);
      const nextStep = STEPS[nextIndex];

      return {
        ...prev,
        currentStep: nextStep,
        history: {
          ...prev.history,
          [step]: [snapshot, ...prev.history[step]],
        },
      };
    });
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16 }}>
      <h2>Quy trình 5 bước</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {STEPS.map((s) => (
          <button
            key={s}
            onClick={() => goToStep(s)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #ddd',
              background: s === activeStep ? '#4f46e5' : '#fff',
              color: s === activeStep ? '#fff' : '#111',
            }}
          >
            {stepLabel[s]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
          <h3>{stepLabel[activeStep]} - Form hiện tại</h3>

          {activeStep === 'step1' && (
            <label>
              Họ tên:
              <input
                value={activeData.fullName ?? ''}
                onChange={(e) => updateField('fullName', e.target.value)}
                style={{ marginLeft: 8 }}
              />
            </label>
          )}

          {activeStep === 'step2' && (
            <label>
              Địa chỉ:
              <input
                value={activeData.address ?? ''}
                onChange={(e) => updateField('address', e.target.value)}
                style={{ marginLeft: 8 }}
              />
            </label>
          )}

          {(activeStep === 'step3' || activeStep === 'step4' || activeStep === 'step5') && (
            <label>
              Ghi chú:
              <input
                value={activeData.note ?? ''}
                onChange={(e) => updateField('note', e.target.value)}
                style={{ marginLeft: 8 }}
              />
            </label>
          )}

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={() => pushHistory('save')}>Lưu</button>
            <button onClick={completeStep}>Hoàn thành bước</button>
          </div>

          <pre style={{ marginTop: 12, background: '#fafafa', padding: 8, fontSize: 12 }}>
{JSON.stringify(state.current, null, 2)}
          </pre>
        </div>

        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
          <h3>Lịch sử {stepLabel[activeStep]}</h3>
          {activeHistory.length === 0 && <p>Chưa có lịch sử.</p>}

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {activeHistory.map((h) => (
              <li key={h.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
                <div>
                  <b>v{h.version}</b> · {h.action} · {new Date(h.at).toLocaleString()}
                </div>
                <pre style={{ fontSize: 11, background: '#fafafa', padding: 6 }}>
{JSON.stringify(h.data, null, 2)}
                </pre>
                <button onClick={() => restoreHistoryForStep(activeStep, h.id)}>Khôi phục bản này</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

## Vì sao cách này không bị “rối mất”

- `current` lưu riêng từng bước: `current.step1`, `current.step2`, ... nên đổi bước không reset bước khác.
- `history` lưu riêng từng bước: `history.step1[]`, `history.step2[]`, ... nên lịch sử không trộn.
- Khôi phục lịch sử dùng hàm `restoreHistoryForStep(step, id)` chỉ ghi vào `current[step]` → các bước còn lại giữ nguyên.
- Mọi cập nhật state đều immutable (`...prev`, `...prev.current`, `...prev.history`) nên tránh ghi đè nhầm object cha.

## Kịch bản đúng theo mong muốn

1. Ở step1 nhập `Nguyễn Văn A` → bấm **Lưu**: thêm 1 item vào `history.step1`.
2. Sang step2 nhập `Hà Nội` → bấm **Lưu**: thêm 1 item vào `history.step2`.
3. Quay lại step1 vẫn thấy `Nguyễn Văn A` (vì `current.step1` được giữ nguyên).
4. Chọn lịch sử cũ ở step1 (ví dụ chứa `Nguyễn Văn B`) → chỉ `current.step1` đổi thành `Nguyễn Văn B`, `current.step2` vẫn là `Hà Nội`.

## Gợi ý mở rộng

- Lưu state xuống backend/localStorage theo caseId.
- Thêm cờ `dirty` theo từng bước để cảnh báo chưa lưu.
- Giới hạn số bản lịch sử (ví dụ giữ 50 bản/bước).
