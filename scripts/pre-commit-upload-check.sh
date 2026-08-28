#!/bin/bash
# Pre-commit hook: Warn when upload-related files are changed
#
# This hook checks if any upload-related files are being committed and
# prints a warning + checklist to prevent regressions.
#
# To install: cp scripts/pre-commit-upload-check.sh .git/hooks/pre-commit

UPLOAD_FILES=(
  "src/lib/editor/uploadLimits.js"
  "src/lib/editor/uploadPipeline.js"
  "src/lib/editor/validateFile.js"
  "src/lib/editor/upload.js"
  "src/lib/muapi.js"
  "src/lib/supabase.js"
  "src/lib/hybrid-supabase.js"
  "src/components/UploadPicker.js"
  "src/lib/editor/dragDrop.js"
  "supabase/functions/muapi-proxy/index.ts"
)

UPLOAD_E2E_TESTS=(
  "e2e/upload-boundary.spec.js"
  "e2e/upload-matrix.spec.js"
  "e2e/upload-picker.spec.js"
)

# Get list of files being committed
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

CHANGED_UPLOAD_FILES=()
CHANGED_E2E_TESTS=()

for file in $STAGED_FILES; do
  for upload_file in "${UPLOAD_FILES[@]}"; do
    if [[ "$file" == *"$upload_file"* ]]; then
      CHANGED_UPLOAD_FILES+=("$file")
    fi
  done
  for test_file in "${UPLOAD_E2E_TESTS[@]}"; do
    if [[ "$file" == *"$test_file"* ]]; then
      CHANGED_E2E_TESTS+=("$file")
    fi
  done
done

if [ ${#CHANGED_UPLOAD_FILES[@]} -eq 0 ]; then
  exit 0
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  ⚠️  UPLOAD SYSTEM FILES CHANGED                              ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "The following upload-related files are being committed:"
for file in "${CHANGED_UPLOAD_FILES[@]}"; do
  echo "  - $file"
done
echo ""
echo "CHECKLIST — verify before committing:"
echo ""
echo "  □ Size limits match across ALL files?"
echo "    Single source of truth: src/lib/editor/uploadLimits.js"
echo "    (image=10MB, video=50MB, audio=10MB, other=10MB)"
echo ""
echo "  □ muapi-proxy/index.ts MAX_IMAGE_BYTES / MAX_VIDEO_BYTES synced?"
echo ""
echo "  □ New limits added to e2e/upload-boundary.spec.js test?"
echo ""
echo "  □ validateFile.js FILE_TYPE_CONFIG uses UPLOAD_LIMITS import?"
echo ""
echo "  □ UploadPicker.js MUAPI_LIMITS uses UPLOAD_LIMITS import?"
echo ""
echo "  □ dragDrop.js FILE_TYPES uses UPLOAD_EXTENSIONS/MIME_TYPES imports?"
echo ""

if [ ${#CHANGED_E2E_TESTS[@]} -gt 0 ]; then
  echo "✅ Upload E2E tests also modified:"
  for file in "${CHANGED_E2E_TESTS[@]}"; do
    echo "  - $file"
  done
  echo ""
else
  echo "⚠️  No upload E2E tests were modified."
  echo "   Consider updating e2e/upload-boundary.spec.js if limits changed."
  echo ""
fi

echo "To bypass this check (not recommended): git commit --no-verify"
echo ""

# Don't block the commit, just warn
exit 0
