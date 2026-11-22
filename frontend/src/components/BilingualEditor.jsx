import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Filter, Layers, LoaderCircle } from 'lucide-react';
import { editorApi } from '../services/api';
import EditorHeader from './EditorHeader';
import GlossarySidebar from './GlossarySidebar';
import QaPanel from './QaPanel';
import SegmentRow from './SegmentRow';

const EMPTY_DATA = {
  chapter: null,
  novel: null,
  summary: { total: 0, completed: 0, needsReview: 0, failed: 0, percent: 0 },
  glossary: [],
  segments: [],
  qa: { issues: [], summary: { total: 0, errors: 0, warnings: 0, ignored: 0 } },
};

export default function BilingualEditor({ chapterId, onBack }) {
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [showGlossary, setShowGlossary] = useState(false);
  const [showQa, setShowQa] = useState(true);
  const [onlyReview, setOnlyReview] = useState(false);
  const [retranslatingId, setRetranslatingId] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [qaRunning, setQaRunning] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [toast, setToast] = useState(null);
  const saveQueues = useRef({});

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadEditor = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await editorApi.getChapterEditor(chapterId);
      setData(response.data.data);
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Không thể tải dữ liệu trình biên tập');
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    // Loading remote chapter data is the synchronization performed by this effect.
    // oxlint-disable-next-line react/set-state-in-effect
    loadEditor();
  }, [loadEditor]);

  const updateQa = (response) => {
    const payload = response?.data;
    if (payload?.data && Array.isArray(payload.data)) {
      setData((previous) => ({ ...previous, qa: { issues: payload.data, summary: payload.summary } }));
    } else if (payload?.qa) {
      setData((previous) => ({ ...previous, qa: payload.qa }));
    }
  };

  const handleTextChange = (segmentId, newText) => {
    const completed = Boolean(newText.trim());
    setSaveStatus('saving');
    setData((previous) => {
      const segments = previous.segments.map((segment) => (
        segment.id === segmentId
          ? { ...segment, translatedText: newText, status: completed ? 'COMPLETED' : 'PENDING' }
          : segment
      ));
      const completedCount = segments.filter((segment) => segment.status === 'COMPLETED').length;
      return {
        ...previous,
        segments,
        summary: {
          ...previous.summary,
          completed: completedCount,
          percent: segments.length ? Math.round((completedCount / segments.length) * 100) : 0,
        },
      };
    });

    const previousSave = saveQueues.current[segmentId] || Promise.resolve();
    const currentSave = previousSave
      .catch(() => undefined)
      .then(() => editorApi.updateSegment(segmentId, { translatedText: newText }))
      .then((response) => {
        setData((previous) => ({
          ...previous,
          chapter: response.data.chapter ? { ...previous.chapter, ...response.data.chapter } : previous.chapter,
          summary: response.data.summary || previous.summary,
          qa: response.data.qa || previous.qa,
        }));
        setSaveStatus('saved');
        return response;
      })
      .catch((error) => {
        setSaveStatus('error');
        showToast(error.response?.data?.message || 'Không thể lưu bản dịch', 'error');
        throw error;
      });
    saveQueues.current[segmentId] = currentSave;
    return currentSave;
  };

  const handleToggleReview = async (segmentId) => {
    const original = data.segments.find((segment) => segment.id === segmentId);
    if (!original) return;
    const applyValue = (needsReview) => setData((previous) => {
      const segments = previous.segments.map((segment) => (
        segment.id === segmentId ? { ...segment, needsReview } : segment
      ));
      return {
        ...previous,
        segments,
        summary: { ...previous.summary, needsReview: segments.filter((segment) => segment.needsReview).length },
      };
    });

    applyValue(!original.needsReview);
    try {
      const response = await editorApi.toggleReview(segmentId);
      applyValue(response.data.data.needsReview);
    } catch (error) {
      applyValue(original.needsReview);
      showToast(error.response?.data?.message || 'Không thể cập nhật trạng thái xem lại', 'error');
    }
  };

  const runQa = async (quiet = false) => {
    setQaRunning(true);
    try {
      const response = await editorApi.runQa(chapterId);
      updateQa(response);
      if (!quiet) showToast('Đã kiểm tra chất lượng toàn chương');
      return response.data.summary;
    } catch (error) {
      showToast(error.response?.data?.message || 'Không thể chạy kiểm tra QA', 'error');
      return null;
    } finally {
      setQaRunning(false);
    }
  };

  const handleRetranslate = async (segmentId) => {
    setRetranslatingId(segmentId);
    try {
      const response = await editorApi.retranslateSegment(segmentId, data.chapter?.translationStyle);
      setData((previous) => ({
        ...previous,
        segments: previous.segments.map((segment) => segment.id === segmentId ? response.data.data : segment),
      }));
      await runQa(true);
      showToast('Đã dịch lại đoạn bằng Gemini');
    } catch (error) {
      showToast(error.response?.data?.message || 'Không thể dịch lại đoạn', 'error');
    } finally {
      setRetranslatingId(null);
    }
  };

  const handleQaAction = async (issueId, action) => {
    try {
      const response = action === 'ignore'
        ? await editorApi.ignoreQaIssue(issueId)
        : await editorApi.restoreQaIssue(issueId);
      const changed = response.data.data;
      setData((previous) => {
        const issues = previous.qa.issues.map((issue) => issue.id === issueId ? { ...issue, ...changed } : issue);
        return {
          ...previous,
          qa: {
            issues,
            summary: {
              total: issues.length,
              errors: issues.filter((issue) => issue.severity === 'ERROR' && !issue.ignored).length,
              warnings: issues.filter((issue) => issue.severity === 'WARNING' && !issue.ignored).length,
              ignored: issues.filter((issue) => issue.ignored).length,
            },
          },
        };
      });
    } catch (error) {
      showToast(error.response?.data?.message || 'Không thể cập nhật cảnh báo', 'error');
    }
  };

  const jumpToIssue = (issue) => {
    setOnlyReview(false);
    setHighlightedId(issue.segmentId);
    window.setTimeout(() => {
      const element = document.getElementById(`segment-${issue.segmentId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.querySelector('textarea')?.focus({ preventScroll: true });
      window.setTimeout(() => setHighlightedId(null), 1800);
    }, 50);
  };

  const handleCompleteReview = async () => {
    const saveResults = await Promise.allSettled(Object.values(saveQueues.current));
    if (saveResults.some((result) => result.status === 'rejected')) {
      showToast('Còn thay đổi chưa lưu được. Hãy thử lại trước khi duyệt chương.', 'error');
      return;
    }
    const qaSummary = await runQa(true);
    if (!qaSummary) return;
    if (qaSummary.errors > 0) {
      setShowQa(true);
      setShowGlossary(false);
      showToast(`Còn ${qaSummary.errors} lỗi QA bắt buộc phải sửa`, 'error');
      return;
    }
    if (data.summary?.needsReview > 0 && !window.confirm(`Còn ${data.summary.needsReview} đoạn được đánh dấu cần xem lại. Vẫn hoàn tất duyệt?`)) return;

    setIsCompleting(true);
    try {
      const response = await editorApi.completeReview(chapterId, true);
      setData((previous) => ({ ...previous, chapter: { ...previous.chapter, ...response.data.data } }));
      showToast('Đã hoàn tất duyệt chương');
    } catch (error) {
      showToast(error.response?.data?.message || 'Không thể hoàn tất duyệt chương', 'error');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleTranslateChapter = async () => {
    setIsTranslating(true);
    try {
      const response = await editorApi.translateChapter(chapterId, data.chapter?.translationStyle || 'natural');
      showToast(response.data.message || 'Đã xử lý lượt dịch chương');
      await loadEditor();
    } catch (error) {
      showToast(error.response?.data?.message || 'Không thể dịch chương bằng AI', 'error');
    } finally {
      setIsTranslating(false);
    }
  };

  if (loading) {
    return <div className="min-h-[calc(100vh-73px)] flex items-center justify-center gap-3 text-sm text-slate-600"><LoaderCircle className="w-5 h-5 animate-spin text-blue-700" /> Đang tải trình biên tập...</div>;
  }
  if (loadError) {
    return (
      <div className="min-h-[calc(100vh-73px)] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-9 h-9 text-rose-700 mx-auto" />
          <h1 className="text-xl font-semibold mt-4">Không mở được chương</h1>
          <p className="text-sm text-slate-600 mt-2">{loadError}</p>
          <button type="button" onClick={onBack} className="mt-5 min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold">Trở lại thư viện</button>
        </div>
      </div>
    );
  }

  const displayedSegments = onlyReview ? data.segments.filter((segment) => segment.needsReview) : data.segments;
  const issuesBySegment = (data.qa?.issues || []).reduce((result, issue) => {
    if (!result[issue.segmentId]) result[issue.segmentId] = [];
    result[issue.segmentId].push(issue);
    return result;
  }, {});

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {toast && (
        <div role="status" className={`fixed bottom-5 right-5 z-[70] max-w-sm px-4 py-3 rounded-lg shadow-xl text-sm font-semibold text-white ${toast.type === 'error' ? 'bg-rose-700' : 'bg-emerald-700'}`}>
          {toast.message}
        </div>
      )}

      <EditorHeader
        chapter={data.chapter}
        novel={data.novel}
        summary={data.summary}
        qaSummary={data.qa?.summary}
        saveStatus={saveStatus}
        showGlossary={showGlossary}
        setShowGlossary={(value) => { setShowGlossary(value); if (value) setShowQa(false); }}
        showQa={showQa}
        setShowQa={(value) => { setShowQa(value); if (value) setShowGlossary(false); }}
        onCompleteReview={handleCompleteReview}
        isCompleting={isCompleting}
        onTranslateChapter={handleTranslateChapter}
        isTranslating={isTranslating}
        onBack={onBack}
      />

      <div className="flex-1 flex flex-col xl:flex-row max-w-[1680px] w-full mx-auto">
        <main className="flex-1 p-4 md:p-6 space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-4 bg-white px-4 py-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Layers className="w-4 h-4 text-blue-700" />
              <span>Hiển thị <strong>{displayedSegments.length}</strong> trong {data.segments.length} đoạn</span>
            </div>
            <button type="button" onClick={() => setOnlyReview((value) => !value)} className={`min-h-10 flex items-center gap-2 px-3 rounded-lg text-xs font-semibold border ${onlyReview ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              <Filter className="w-3.5 h-3.5" />
              {onlyReview ? 'Hiện tất cả đoạn' : 'Chỉ đoạn cần xem lại'}
            </button>
          </div>

          {displayedSegments.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-sm font-semibold text-slate-800">
                {data.segments.length === 0 ? 'Chương chưa được chia đoạn' : 'Không có đoạn phù hợp với bộ lọc hiện tại.'}
              </p>
              {data.segments.length === 0 && (
                <>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Bắt đầu dịch để hệ thống chia nội dung gốc thành các đoạn, lưu từng kết quả và áp dụng bảng thuật ngữ.</p>
                  <button type="button" disabled={isTranslating} onClick={handleTranslateChapter} className="mt-5 min-h-11 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                    {isTranslating ? 'Đang dịch chương...' : 'Bắt đầu dịch bằng AI'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {displayedSegments.map((segment) => (
                <SegmentRow
                  key={segment.id}
                  segment={segment}
                  issues={issuesBySegment[segment.id] || []}
                  highlighted={highlightedId === segment.id}
                  sourceLang={data.novel?.sourceLanguage}
                  targetLang={data.novel?.targetLanguage}
                  onTextChange={handleTextChange}
                  onToggleReview={handleToggleReview}
                  onRetranslate={handleRetranslate}
                  isRetranslating={retranslatingId === segment.id}
                />
              ))}
            </div>
          )}
        </main>

        {showQa && (
          <QaPanel
            qa={data.qa}
            running={qaRunning}
            onRun={() => runQa(false)}
            onJump={jumpToIssue}
            onIgnore={(id) => handleQaAction(id, 'ignore')}
            onRestore={(id) => handleQaAction(id, 'restore')}
            onClose={() => setShowQa(false)}
          />
        )}
        {showGlossary && <GlossarySidebar glossary={data.glossary} onClose={() => setShowGlossary(false)} />}
      </div>
    </div>
  );
}
