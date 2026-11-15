import React, { useState, useEffect } from 'react';
import EditorHeader from './EditorHeader';
import SegmentRow from './SegmentRow';
import GlossarySidebar from './GlossarySidebar';
import { editorApi } from '../services/api';
import { Filter, AlertTriangle, BookOpen, Layers } from 'lucide-react';

// Dữ liệu mẫu demo trực quan nếu chưa chọn ID chương từ database
const DEMO_DATA = {
  chapter: {
    id: 'demo-chapter-1',
    chapterNumber: 1,
    title: 'Gia tộc Ô Thản Thành, Hóa Ra Là Phế Vật',
    status: 'TRANSLATED',
    translationStyle: 'xianxia',
  },
  novel: {
    id: 'demo-novel-1',
    title: 'Đấu Phá Thương Khung (斗破苍穹)',
    originalTitle: '斗破苍穹',
    sourceLanguage: 'zh',
    targetLanguage: 'vi',
  },
  summary: {
    total: 4,
    completed: 4,
    needsReview: 1,
    failed: 0,
    percent: 100,
  },
  glossary: [
    { id: '1', originalTerm: '萧炎', vietnameseTerm: 'Tiêu Viêm', category: 'CHARACTER', notes: 'Nhân vật chính' },
    { id: '2', originalTerm: '乌坦城', vietnameseTerm: 'Ô Thản Thành', category: 'LOCATION', notes: 'Thành phố khởi đầu' },
    { id: '3', originalTerm: '斗气', vietnameseTerm: 'Đấu khí', category: 'REALM', notes: 'Năng lượng tu luyện' },
    { id: '4', originalTerm: '斗之气三段', vietnameseTerm: 'Đấu Chi Khí tam đoạn', category: 'REALM', notes: 'Cảnh giới khởi đầu' },
    { id: '5', originalTerm: '吸掌', vietnameseTerm: 'Hấp Chưởng', category: 'SKILL', notes: 'Đấu kỹ huyền giai' },
  ],
  segments: [
    {
      id: 'seg-1',
      orderIndex: 0,
      originalText: '“斗之力，三段！”\n望着测验魔石碑上面闪亮得甚至有些刺眼的五个大字，少年面无表情，唇角有着一抹自嘲，紧握的手掌，因为大力，而导致略微尖锐的指甲深深的刺进了掌心之中，带来一阵阵钻心的疼痛…',
      translatedText: '"Đấu chi khí, tam đoạn!"\nNhìn năm chữ lớn sáng rực thậm chí có chút chói mắt trên ma thạch bia khảo nghiệm, thiếu niên không hề có biểu cảm, khóe môi hiện lên một nụ cười tự giễu. Bàn tay siết chặt vì dùng sức quá mức khiến đầu móng tay cắm sâu vào lòng bàn tay, mang đến từng cơn đau nhói thấu tim...',
      status: 'COMPLETED',
      needsReview: false,
    },
    {
      id: 'seg-2',
      orderIndex: 1,
      originalText: '“萧炎，斗之力，三段！级别：低级！”测验魔石碑之旁，一位中年男子，看了一眼碑上所显示出来的信息，语气漠然的将之公布了出来…',
      translatedText: '"Tiêu Viêm, Đấu chi khí, tam đoạn! Cấp bậc: Cấp thấp!" Bên cạnh ma thạch bia, một người đàn ông trung niên liếc nhìn thông tin hiển thị trên bia đá, cất giọng lạnh nhạt công bố kết quả...',
      status: 'COMPLETED',
      needsReview: false,
    },
    {
      id: 'seg-3',
      orderIndex: 2,
      originalText: '中年男子话刚脱口，便是不出意料的在人头汹涌的广场上带起了一阵嘲讽的骚动。\n“三段？嘿嘿，果然不出我所料，这个“天才”这一年又是在原地踏步！”',
      translatedText: 'Lời người đàn ông vừa dứt, không ngoài dự đoán đã dấy lên một hồi xôn xao châm biếm khắp quảng trường đông nghịt người.\n"Tam đoạn? Hắc hắc, quả nhiên không ngoài dự đoán của ta, \'thiên tài\' này năm nay lại giậm chân tại chỗ rồi!"',
      status: 'COMPLETED',
      needsReview: true, // Đoạn được đánh dấu xem lại
    },
    {
      id: 'seg-4',
      orderIndex: 3,
      originalText: '“哎，真是把家族的脸都丢光了，当年他四岁练气，十岁拥有九段斗之气，十一岁突破十段斗之气，成功凝聚斗之气旋，一跃成为家族百年内最年轻的斗者…”',
      translatedText: '"Ai, thật là làm mất hết thể diện của gia tộc. Năm đó hắn bốn tuổi luyện khí, mười tuổi sở hữu cửu đoạn đấu chi khí, mười một tuổi đột phá thập đoạn đấu chi khí, thành công ngưng tụ đấu khí toàn, nhảy vọt trở thành Đấu giả trẻ tuổi nhất trong trăm năm qua của gia tộc..."',
      status: 'COMPLETED',
      needsReview: false,
    },
  ],
};

export default function BilingualEditor({ chapterId }) {
  const [data, setData] = useState(DEMO_DATA);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'error' | 'idle'
  const [showGlossary, setShowGlossary] = useState(true);
  const [onlyReview, setOnlyReview] = useState(false);
  const [retranslatingId, setRetranslatingId] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Tải dữ liệu từ backend nếu có chapterId thật
  useEffect(() => {
    if (!chapterId || chapterId === 'demo') return;

    let isMounted = true;
    setLoading(true);
    editorApi
      .getChapterEditor(chapterId)
      .then((res) => {
        if (isMounted && res.data?.data) {
          setData(res.data.data);
        }
      })
      .catch((err) => {
        console.error('Lỗi tải dữ liệu biên tập:', err);
        showToast('Không thể kết nối API chương thật, chuyển sang dữ liệu mẫu', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [chapterId]);

  // Xử lý lưu nháp văn bản khi người dùng sửa
  const handleTextChange = async (segmentId, newText) => {
    setSaveStatus('saving');

    // Cập nhật State cục bộ ngay lập tức
    setData((prev) => {
      const updatedSegments = prev.segments.map((seg) =>
        seg.id === segmentId ? { ...seg, translatedText: newText, status: 'COMPLETED' } : seg
      );
      const completed = updatedSegments.filter((s) => s.status === 'COMPLETED').length;
      return {
        ...prev,
        segments: updatedSegments,
        summary: {
          ...prev.summary,
          completed,
          percent: Math.round((completed / updatedSegments.length) * 100),
        },
      };
    });

    // Nếu là chapterId thật, gọi API backend
    if (chapterId && chapterId !== 'demo') {
      try {
        await editorApi.updateSegment(segmentId, { translatedText: newText });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Lỗi tự động lưu nháp:', err);
        setSaveStatus('error');
      }
    } else {
      // Giả lập lưu nháp cho demo
      setTimeout(() => setSaveStatus('saved'), 400);
    }
  };

  // Bật/tắt cờ cần xem lại
  const handleToggleReview = async (segmentId) => {
    setData((prev) => {
      const updatedSegments = prev.segments.map((seg) =>
        seg.id === segmentId ? { ...seg, needsReview: !seg.needsReview } : seg
      );
      const needsReview = updatedSegments.filter((s) => s.needsReview).length;
      return {
        ...prev,
        segments: updatedSegments,
        summary: { ...prev.summary, needsReview },
      };
    });

    if (chapterId && chapterId !== 'demo') {
      try {
        await editorApi.toggleReview(segmentId);
      } catch (err) {
        console.error('Lỗi đổi trạng thái review:', err);
      }
    }
  };

  // Dịch lại đoạn lẻ bằng Gemini
  const handleRetranslate = async (segmentId) => {
    setRetranslatingId(segmentId);
    showToast('Đang gửi yêu cầu dịch lại đoạn tới Gemini AI...', 'info');

    if (chapterId && chapterId !== 'demo') {
      try {
        const res = await editorApi.retranslateSegment(segmentId, data.chapter?.translationStyle);
        if (res.data?.data) {
          setData((prev) => ({
            ...prev,
            segments: prev.segments.map((seg) => (seg.id === segmentId ? res.data.data : seg)),
          }));
          showToast('Dịch lại đoạn thành công!', 'success');
        }
      } catch (err) {
        console.error('Lỗi khi dịch lại đoạn:', err);
        showToast(err.response?.data?.message || 'Lỗi khi gọi Gemini AI', 'error');
      } finally {
        setRetranslatingId(null);
      }
    } else {
      // Demo giả lập dịch lại
      setTimeout(() => {
        setData((prev) => ({
          ...prev,
          segments: prev.segments.map((seg) =>
            seg.id === segmentId
              ? {
                  ...seg,
                  translatedText: seg.translatedText + ' [AI vừa trau chuốt lại]',
                  needsReview: false,
                }
              : seg
          ),
        }));
        setRetranslatingId(null);
        showToast('Dịch lại đoạn mẫu thành công!', 'success');
      }, 1000);
    }
  };

  // Xác nhận hoàn tất duyệt chương
  const handleCompleteReview = async () => {
    if (data.summary?.needsReview > 0) {
      const confirmForce = window.confirm(
        `Vẫn còn ${data.summary.needsReview} đoạn được đánh dấu "Cần xem lại". Bạn có chắc chắn muốn xác nhận hoàn tất duyệt chương không?`
      );
      if (!confirmForce) return;
    }

    setIsCompleting(true);
    if (chapterId && chapterId !== 'demo') {
      try {
        await editorApi.completeReview(chapterId, true);
        setData((prev) => ({
          ...prev,
          chapter: { ...prev.chapter, status: 'REVIEWED' },
        }));
        showToast('Đã xác nhận hoàn tất biên tập chương!', 'success');
      } catch (err) {
        showToast(err.response?.data?.message || 'Lỗi khi hoàn tất chương', 'error');
      } finally {
        setIsCompleting(false);
      }
    } else {
      setTimeout(() => {
        setData((prev) => ({
          ...prev,
          chapter: { ...prev.chapter, status: 'REVIEWED' },
        }));
        setIsCompleting(false);
        showToast('Đã xác nhận hoàn tất duyệt chương mẫu!', 'success');
      }, 600);
    }
  };

  const displayedSegments = onlyReview
    ? data.segments.filter((s) => s.needsReview)
    : data.segments;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold text-white transition-all transform animate-bounce ${
            toast.type === 'error' ? 'bg-rose-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-emerald-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <EditorHeader
        chapter={data.chapter}
        novel={data.novel}
        summary={data.summary}
        saveStatus={saveStatus}
        showGlossary={showGlossary}
        setShowGlossary={setShowGlossary}
        onCompleteReview={handleCompleteReview}
        isCompleting={isCompleting}
      />

      {/* Main Body */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        {/* Editor Content */}
        <main className="flex-1 p-4 md:p-6 space-y-4 overflow-y-auto">
          {/* Sub Toolbar */}
          <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Hiển thị: <strong>{displayedSegments.length}</strong> / {data.segments.length} đoạn</span>
            </div>

            <button
              type="button"
              onClick={() => setOnlyReview(!onlyReview)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                onlyReview
                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{onlyReview ? 'Đang lọc: Cần xem lại' : 'Chỉ xem đoạn cần duyệt'}</span>
              {data.summary?.needsReview > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
                  {data.summary.needsReview}
                </span>
              )}
            </button>
          </div>

          {/* List of 2-Column Segments */}
          <div className="space-y-4">
            {displayedSegments.map((segment) => (
              <SegmentRow
                key={segment.id}
                segment={segment}
                sourceLang={data.novel?.sourceLanguage}
                targetLang={data.novel?.targetLanguage}
                onTextChange={handleTextChange}
                onToggleReview={handleToggleReview}
                onRetranslate={handleRetranslate}
                isRetranslating={retranslatingId === segment.id}
              />
            ))}
          </div>
        </main>

        {/* Glossary Sidebar */}
        {showGlossary && (
          <GlossarySidebar
            glossary={data.glossary}
            onClose={() => setShowGlossary(false)}
          />
        )}
      </div>
    </div>
  );
}
