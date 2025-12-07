// ===============================
// 0. 서울시 따릉이 실시간 API 키
// ===============================
const SEOUL_API_KEY = "647161706377657438376c7763516c";

// ===============================
// Supabase 클라이언트
// ===============================
const SUPABASE_URL = "https://zumedjwdcqzgiawvtrvv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bWVkandkY3F6Z2lhd3Z0cnZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MzkzOTQsImV4cCI6MjA4MDMxNTM5NH0.1FFz6aCSMCT1ropLIQNCprVDp0t9gB7U7y_XOvYWv4U";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===============================
// 1. 지도 기본 설정
// ===============================
const seoulCenter = [37.5665, 126.978];

const map = L.map("map").setView(seoulCenter, 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

// 📍 따릉이 마커
const stationIcon = L.divIcon({
  className: "station-marker",
  html: "📍",
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

// 내 위치
let myLocation = null;
let myLocationMarker = null;

// ===============================
// 2. 서울시 구별 중심좌표
// ===============================
const districtCenters = {
  강남구: [37.5172, 127.0473],
  강동구: [37.5301, 127.1238],
  강북구: [37.6396, 127.0254],
  강서구: [37.5509, 126.8495],
  관악구: [37.4781, 126.9516],
  광진구: [37.5385, 127.0822],
  구로구: [37.4955, 126.8877],
  금천구: [37.4574, 126.895],
  노원구: [37.6542, 127.0568],
  도봉구: [37.6688, 127.046],
  동대문구: [37.5744, 127.0396],
  동작구: [37.5124, 126.9393],
  마포구: [37.5634, 126.908],
  서대문구: [37.5826, 126.9351],
  서초구: [37.4837, 127.0324],
  성동구: [37.5634, 127.0365],
  성북구: [37.5894, 127.0167],
  송파구: [37.5145, 127.1056],
  양천구: [37.5169, 126.8664],
  영등포구: [37.5264, 126.8962],
  용산구: [37.5324, 126.9904],
  은평구: [37.6177, 126.9227],
  종로구: [37.573, 126.9794],
  중구: [37.563, 126.9976],
  중랑구: [37.606, 127.0928],
};
const districts = Object.keys(districtCenters);

// ===============================
// 3. DOM 요소
// ===============================
let allStations = [];
let filteredStations = [];
let markerList = [];
let selectedGu = null;

const resultListEl = document.getElementById("resultList");
const resultCountEl = document.getElementById("resultCount");
const currentGuEl = document.getElementById("currentGu");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const myLocationBtn = document.getElementById("myLocationBtn");
const districtButtonsEl = document.getElementById("districtButtons");

// ===============================
// 4. 탭 전환
// ===============================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.getAttribute("data-target");
    document.querySelectorAll(".tab-content").forEach((sec) =>
      sec.classList.remove("active")
    );
    document.getElementById(target).classList.add("active");

    if (target === "tab-map") {
      setTimeout(() => map.invalidateSize(), 50);
    }
  });
});

// ===============================
// 5. 구 카테고리 버튼 생성
// ===============================
districts.forEach((gu) => {
  const btn = document.createElement("button");
  btn.classList.add("district-btn");
  btn.textContent = gu;

  btn.addEventListener("click", () => {
    if (selectedGu === gu) {
      selectedGu = null;
      highlightDistrictButton(null);
      currentGuEl.textContent = "현재 위치: -";
      applyFilter(false);
      map.setView(seoulCenter, 12);
    } else {
      selectedGu = gu;
      highlightDistrictButton(btn);
      currentGuEl.textContent = `현재 위치: ${gu}`;
      applyFilter(true);
      map.setView(districtCenters[gu], 14);
    }
  });

  districtButtonsEl.appendChild(btn);
});

function highlightDistrictButton(activeBtn) {
  document
    .querySelectorAll(".district-btn")
    .forEach((b) => b.classList.remove("active"));
  if (activeBtn) activeBtn.classList.add("active");
}

// ===============================
// 6. CSV 로드 (정적 대여소 정보)
// ===============================
Papa.parse("data/stations.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function (results) {
    console.log("CSV 로드, raw rows:", results.data.length);

    allStations = results.data
      .map((row) => {
        const name = row.name || row.대여소명 || row.대여소명칭 || row.대여소;
        const district = row.district || row.자치구 || row.gu || row.구;
        const address = row.address || row.주소 || "";
        const lat = parseFloat(row.lat || row.latitude || row.위도);
        const lng = parseFloat(row.lng || row.longitude || row.경도);

        if (!name || !district || Number.isNaN(lat) || Number.isNaN(lng)) {
          return null;
        }

        return {
          name,
          district,
          address,
          lat,
          lng,
          bikesAvailable: null,
          returnSlots: null,
          distance: null,
        };
      })
      .filter(Boolean);

    console.log("정상 변환된 대여소 개수:", allStations.length);

    filteredStations = allStations.slice();
    drawMarkers(filteredStations);
    updateList(filteredStations);

    enhanceWithRealTime();
  },
  error: function (err) {
    console.error("CSV 파싱 에러:", err);
    resultListEl.textContent = "데이터를 불러오지 못했습니다. (csv 경로/이름 확인)";
  },
});

// ===============================
// 7. 실시간 API 불러오기
// ===============================
async function fetchRealTimeData() {
  console.log("📡 fetchRealTimeData 시작, KEY =", SEOUL_API_KEY);

  if (!SEOUL_API_KEY) {
    console.warn("서울시 API 키가 설정되지 않았습니다.");
    return [];
  }

  const ranges = [
    [1, 1000],
    [1001, 2000],
    [2001, 3000],
  ];

  const allRows = [];

  for (const [start, end] of ranges) {
    const url = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/bikeList/${start}/${end}/`;
    console.log(`👉 요청: ${start} ~ ${end}`);

    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log(`응답(앞 120자, ${start}~${end}):`, text.slice(0, 120));

      if (text.trim().startsWith("<RESULT>")) {
        console.warn(`⚠ ${start}~${end} 구간에서 API 에러 발생, 스킵`);
        continue;
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error(`JSON 파싱 실패 (${start}~${end})`, e);
        continue;
      }

      if (json.rentBikeStatus && Array.isArray(json.rentBikeStatus.row)) {
        allRows.push(...json.rentBikeStatus.row);
      } else {
        console.warn(`예상과 다른 응답 구조 (${start}~${end})`, json);
      }
    } catch (e) {
      console.error(`실시간 데이터 요청 실패 (${start}~${end})`, e);
    }
  }

  console.log("실시간 대여소 데이터 개수 합계:", allRows.length);
  return allRows;
}

// ===============================
// 8. 실시간 데이터 매칭 (이름 우선 + 좌표 보정)
// ===============================
async function enhanceWithRealTime() {
  console.log("🔥 enhanceWithRealTime 호출됨");

  const realtimeRows = await fetchRealTimeData();
  if (!realtimeRows.length) {
    console.warn("실시간 데이터가 없어 정적 데이터만 사용합니다.");
    return;
  }

  let matchedByName = 0;
  let matchedByPos = 0;

  realtimeRows.forEach((rt) => {
    const rtNameRaw = rt.stationName || "";
    const rtNameKey = rtNameRaw.replace(/\s+/g, "");
    const bikes = Number(rt.parkingBikeTotCnt);
    const rack = Number(rt.rackTotCnt);
    const rtLat = parseFloat(rt.stationLatitude);
    const rtLng = parseFloat(rt.stationLongitude);

    if (Number.isNaN(rtLat) || Number.isNaN(rtLng)) return;

    // 1) 이름으로 매칭
    let target = allStations.find((st) => {
      const stNameKey = st.name.replace(/\s+/g, "");
      return stNameKey === rtNameKey;
    });

    if (target) {
      matchedByName++;
    } else {
      // 2) 이름 안 맞으면 좌표로 가장 가까운 대여소
      let best = null;
      let bestDist2 = Infinity;

      allStations.forEach((st) => {
        const dLat = st.lat - rtLat;
        const dLng = st.lng - rtLng;
        const dist2 = dLat * dLat + dLng * dLng;
        if (dist2 < bestDist2) {
          bestDist2 = dist2;
          best = st;
        }
      });

      const threshold = 0.0005 * 0.0005; // 약 50m
      if (best && bestDist2 < threshold) {
        target = best;
        matchedByPos++;
      }
    }

    if (target) {
      target.bikesAvailable = Number.isNaN(bikes) ? null : bikes;
      if (!Number.isNaN(rack)) {
        target.returnSlots = !Number.isNaN(bikes) ? rack - bikes : rack;
      }
    }
  });

  console.log(
    `실시간 매칭 완료: 이름으로 ${matchedByName}개, 좌표로 ${matchedByPos}개`,
  );

  drawMarkers(filteredStations);
  updateList(filteredStations);
}

// ===============================
// 9. 마커 찍기
// ===============================
function drawMarkers(stations) {
  markerList.forEach((m) => map.removeLayer(m));
  markerList = [];

  stations.forEach((st) => {
    const marker = L.marker([st.lat, st.lng], { icon: stationIcon });

    let popupHtml = `<strong>${st.name}</strong><br>${st.district}`;
    if (st.address) popupHtml += `<br>${st.address}`;
    if (st.bikesAvailable != null)
      popupHtml += `<br>🚲 대여 가능 자전거: <b>${st.bikesAvailable}</b>대`;
    if (st.returnSlots != null)
      popupHtml += `<br>🅿 반납 가능 거치대: <b>${st.returnSlots}</b>개`;

    marker.bindPopup(popupHtml).addTo(map);
    markerList.push(marker);
  });
}

// ===============================
// 10. 리스트 렌더링
// ===============================
function updateList(stations) {
  resultListEl.innerHTML = "";
  resultCountEl.textContent = stations.length;

  if (!stations.length) {
    resultListEl.textContent = "검색 결과가 없습니다.";
    return;
  }

  stations.forEach((st) => {
    const item = document.createElement("div");
    item.classList.add("result-item");

    const title = document.createElement("div");
    title.classList.add("result-title");
    title.textContent = st.name;

    const meta = document.createElement("div");
    meta.classList.add("result-meta");
    meta.textContent = `${st.district}${st.address ? " · " + st.address : ""}`;

    const distance = document.createElement("div");
    distance.classList.add("result-distance");
    if (st.distance != null) {
      distance.textContent = `${st.distance.toFixed(2)} km`;
    } else {
      distance.textContent = "";
    }

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(distance);

    item.addEventListener("click", () => {
      map.setView([st.lat, st.lng], 17);

      let popupHtml = `<strong>${st.name}</strong><br>${st.district}`;
      if (st.address) popupHtml += `<br>${st.address}`;
      if (st.bikesAvailable != null)
        popupHtml += `<br>🚲 대여 가능 자전거: <b>${st.bikesAvailable}</b>대`;
      if (st.returnSlots != null)
        popupHtml += `<br>🅿 반납 가능 거치대: <b>${st.returnSlots}</b>개`;

      L.popup().setLatLng([st.lat, st.lng]).setContent(popupHtml).openOn(map);
    });

    resultListEl.appendChild(item);
  });
}

// ===============================
// 11. 검색 / 거리 계산 / 필터
// ===============================
searchBtn.addEventListener("click", () => applyFilter(false));
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") applyFilter(false);
});

function applyFilter(moveMap) {
  const keyword = searchInput.value.trim().toLowerCase();

  let list = allStations.filter((st) => {
    if (selectedGu && st.district !== selectedGu) return false;

    if (!keyword) return true;
    return (
      st.name.toLowerCase().includes(keyword) ||
      st.district.toLowerCase().includes(keyword) ||
      (st.address && st.address.toLowerCase().includes(keyword))
    );
  });

  if (myLocation) {
    list.forEach((st) => {
      st.distance = getDistanceKm(
        myLocation.lat,
        myLocation.lng,
        st.lat,
        st.lng,
      );
    });
    list.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
  }

  filteredStations = list;
  drawMarkers(filteredStations);
  updateList(filteredStations);

  if (moveMap && selectedGu && districtCenters[selectedGu]) {
    map.setView(districtCenters[selectedGu], 14);
  }
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ===============================
// 12. 내 위치 불러오기
// ===============================
myLocationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("이 브라우저는 위치 정보를 지원하지 않습니다.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      myLocation = { lat, lng };

      if (myLocationMarker) {
        map.removeLayer(myLocationMarker);
      }

      myLocationMarker = L.circleMarker([lat, lng], {
        radius: 10,
        color: "#1976d2",
        weight: 3,
        fillColor: "#42a5f5",
        fillOpacity: 0.9,
      })
        .bindPopup("내 위치")
        .addTo(map);

      map.setView([lat, lng], 15);

      applyFilter(false);
    },
    (err) => {
      console.error(err);
      alert("위치 정보를 가져올 수 없습니다.");
    },
    {
      enableHighAccuracy: true,
    },
  );
});

// ===============================
// 13. 게시판 (Supabase + 이미지 업로드)
// ===============================

// DOM
const boardForm = document.getElementById("boardForm");
const boardNameInput = document.getElementById("boardName");
const boardTitleInput = document.getElementById("boardTitle");
const boardContentInput = document.getElementById("boardContent");
const boardImageInput = document.getElementById("boardImage");

const boardListEl = document.getElementById("boardList");
const boardEmptyEl = document.getElementById("boardEmpty");

let boardPosts = []; // [{post, comments: []}, ...]

// ---------- 1) 이미지 업로드 유틸 (스토리지) ----------
async function uploadImageToSupabase(file) {
  if (!file) return null;

  const fileExt = file.name.split(".").pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `posts/${fileName}`;

  const { error } = await supabase.storage
    .from("board-images") // 버킷 이름
    .upload(filePath, file);

  if (error) {
    console.error("이미지 업로드 실패:", error);
    alert("이미지 업로드에 실패했습니다.");
    return null;
  }

  const { data } = supabase.storage.from("board-images").getPublicUrl(filePath);

  return data.publicUrl; // 공개 URL
}

// ---------- 2) 게시글 및 댓글 불러오기 ----------
async function fetchBoardData() {
  // posts
  const { data: posts, error: postErr } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (postErr) {
    console.error("게시글 조회 실패:", postErr);
    return;
  }

  // comments
  const { data: comments, error: cmtErr } = await supabase
    .from("comments")
    .select("*")
    .order("created_at", { ascending: true });

  if (cmtErr) {
    console.error("댓글 조회 실패:", cmtErr);
    return;
  }

  // posts + 해당 댓글 묶기
  const byPostId = {};
  comments.forEach((c) => {
    if (!byPostId[c.post_id]) byPostId[c.post_id] = [];
    byPostId[c.post_id].push(c);
  });

  boardPosts = posts.map((p) => ({
    post: p,
    comments: byPostId[p.id] || [],
  }));

  renderBoardPosts();
}

// ---------- 3) 게시판 렌더링 ----------
function renderBoardPosts() {
  boardListEl.innerHTML = "";

  if (!boardPosts.length) {
    boardEmptyEl.style.display = "block";
    return;
  }
  boardEmptyEl.style.display = "none";

  boardPosts.forEach(({ post, comments }) => {
    const item = document.createElement("div");
    item.classList.add("board-item");

    // 헤더 (제목 + 오른쪽 영역(좋아요/싫어요/삭제))
    const header = document.createElement("div");
    header.classList.add("board-item-header");

    const title = document.createElement("div");
    title.classList.add("board-item-title");
    title.textContent = post.title;

    const headerRight = document.createElement("div");
    headerRight.classList.add("board-header-right");

    // 👍 / 👎 버튼 영역 (제목 오른쪽에 위치)
    const likeBox = document.createElement("div");
    likeBox.classList.add("reaction-box");

    const likeBtn = document.createElement("button");
    likeBtn.classList.add("reaction-btn", "reaction-like");
    likeBtn.innerHTML = `👍 <span>${post.like_count ?? 0}</span>`;

    likeBtn.addEventListener("click", async () => {
      const { data, error } = await supabase
        .from("posts")
        .update({ like_count: (post.like_count || 0) + 1 })
        .eq("id", post.id)
        .select("like_count")
        .single();

      if (error) {
        console.error("좋아요 실패:", error);
        return;
      }
      post.like_count = data.like_count;
      likeBtn.querySelector("span").textContent = data.like_count;
    });

    const dislikeBtn = document.createElement("button");
    dislikeBtn.classList.add("reaction-btn", "reaction-dislike");
    dislikeBtn.innerHTML = `👎 <span>${post.dislike_count ?? 0}</span>`;

    dislikeBtn.addEventListener("click", async () => {
      const { data, error } = await supabase
        .from("posts")
        .update({ dislike_count: (post.dislike_count || 0) + 1 })
        .eq("id", post.id)
        .select("dislike_count")
        .single();

      if (error) {
        console.error("싫어요 실패:", error);
        return;
      }
      post.dislike_count = data.dislike_count;
      dislikeBtn.querySelector("span").textContent = data.dislike_count;
    });

    likeBox.appendChild(likeBtn);
    likeBox.appendChild(dislikeBtn);

    // 삭제 버튼
    const delBtn = document.createElement("button");
    delBtn.classList.add("board-delete");
    delBtn.textContent = "삭제";
    delBtn.addEventListener("click", async () => {
      if (!confirm("이 글을 삭제할까요?")) return;

      const { error } = await supabase.from("posts").delete().eq("id", post.id);

      if (error) {
        console.error("삭제 실패:", error);
        alert("삭제 중 오류가 발생했습니다.");
        return;
      }
      await fetchBoardData();
    });

    // 오른쪽 영역에 [좋아요/싫어요] + [삭제] 순서로 배치
    headerRight.appendChild(likeBox);
    headerRight.appendChild(delBtn);

    header.appendChild(title);
    header.appendChild(headerRight);

    // 메타
    const meta = document.createElement("div");
    meta.classList.add("board-item-meta");
    const createdAt = new Date(post.created_at);
    const createdStr = `${createdAt.getFullYear()}.${String(
      createdAt.getMonth() + 1,
    ).padStart(2, "0")}.${String(createdAt.getDate()).padStart(
      2,
      "0",
    )} ${String(createdAt.getHours()).padStart(2, "0")}:${String(
      createdAt.getMinutes(),
    ).padStart(2, "0")}`;
    meta.textContent = `${post.name} · ${createdStr}`;

    // 내용
    const content = document.createElement("div");
    content.classList.add("board-item-content");
    content.textContent = post.content;

    // 이미지
    if (post.image_url) {
      const img = document.createElement("img");
      img.src = post.image_url;
      img.classList.add("board-image");
      item.appendChild(img);
    }

    // 댓글 목록 (CSS: reply-list / reply-item / reply-text / reply-image)
    const commentList = document.createElement("div");
    commentList.classList.add("reply-list");

    comments.forEach((c) => {
      const row = document.createElement("div");
      row.classList.add("reply-item");

      const text = document.createElement("div");
      text.classList.add("reply-text");
      text.textContent = `${c.name} : ${c.content}`;

      row.appendChild(text);

      if (c.image_url) {
        const cImg = document.createElement("img");
        cImg.src = c.image_url;
        cImg.classList.add("reply-image");
        row.appendChild(cImg);
      }

      commentList.appendChild(row);
    });

    // 대댓글 작성 폼 (CSS: reply-form / reply-name / reply-content / reply-image-input / reply-submit)
    const replyForm = document.createElement("form");
    replyForm.classList.add("reply-form");

    const replyName = document.createElement("input");
    replyName.type = "text";
    replyName.placeholder = "이름";
    replyName.classList.add("reply-name");

    const replyContent = document.createElement("input");
    replyContent.type = "text";
    replyContent.placeholder = "대댓글 내용";
    replyContent.classList.add("reply-content");

    const replyFile = document.createElement("input");
    replyFile.type = "file";
    replyFile.accept = "image/*";
    replyFile.classList.add("reply-image-input");

    const replyBtn = document.createElement("button");
    replyBtn.type = "submit";
    replyBtn.textContent = "등록";
    replyBtn.classList.add("reply-submit");

    replyForm.appendChild(replyName);
    replyForm.appendChild(replyContent);
    replyForm.appendChild(replyFile);
    replyForm.appendChild(replyBtn);

    replyForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = replyName.value.trim();
      const text = replyContent.value.trim();
      const file = replyFile.files[0];

      if (!name || !text) return;

      let cImageUrl = null;
      if (file) {
        cImageUrl = await uploadImageToSupabase(file);
      }

      const { error } = await supabase.from("comments").insert({
        post_id: post.id,
        name,
        content: text,
        image_url: cImageUrl,
      });

      if (error) {
        console.error("댓글 작성 실패:", error);
        alert("댓글 작성 중 오류가 발생했습니다.");
        return;
      }

      await fetchBoardData();
    });

    // 조립
    item.appendChild(header);
    item.appendChild(meta);
    item.appendChild(content);
    item.appendChild(commentList);
    item.appendChild(replyForm);

    boardListEl.appendChild(item);
  });
}

// ---------- 4) 새 게시글 작성 ----------
if (boardForm) {
  boardForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = boardNameInput.value.trim();
    const title = boardTitleInput.value.trim();
    const content = boardContentInput.value.trim();
    const file = boardImageInput.files[0];

    if (!name || !title || !content) return;

    let imageUrl = null;
    if (file) {
      imageUrl = await uploadImageToSupabase(file);
    }

    const { error } = await supabase.from("posts").insert({
      name,
      title,
      content,
      image_url: imageUrl,
    });

    if (error) {
      console.error("글 작성 실패:", error);
      alert("글 작성 중 오류가 발생했습니다.");
      return;
    }

    boardForm.reset();
    await fetchBoardData();
  });
}

// 페이지 처음 로드시 불러오기
fetchBoardData();
