from pathlib import Path

from fastapi.testclient import TestClient

from cover_studio.app import create_app
from cover_studio.project import Project, file_sha1


def test_set_audio_adds_then_replaces_the_previous_file(tmp_path: Path) -> None:
    first = tmp_path / "first.mp3"
    first.write_bytes(b"first audio")
    second = tmp_path / "second.wav"
    second.write_bytes(b"second audio")

    project = Project.create(tmp_path / "projects", "Song")
    project.set_audio(first)

    old_path = project.dir / "audio" / first.name
    assert project.audio_path == old_path
    assert project.data["audio_sha1"] == file_sha1(first)

    project.set_audio(second)

    new_path = project.dir / "audio" / second.name
    assert project.audio_path == new_path
    assert new_path.read_bytes() == second.read_bytes()
    assert project.data["audio_sha1"] == file_sha1(second)
    assert not old_path.exists()


def test_set_audio_replaces_a_file_with_the_same_name(tmp_path: Path) -> None:
    incoming = tmp_path / "song.flac"
    incoming.write_bytes(b"old")
    project = Project.create(tmp_path / "projects", "Song")
    project.set_audio(incoming)
    path = project.dir / "audio" / incoming.name

    incoming.write_bytes(b"new")
    project.set_audio(incoming)

    assert project.audio_path == path
    assert path.read_bytes() == b"new"
    assert project.data["audio_sha1"] == file_sha1(incoming)


def test_upload_audio_endpoint_adds_audio_to_an_existing_project(tmp_path: Path) -> None:
    root = tmp_path / "projects"
    project = Project.create(root, "Song")
    app = create_app(root, object())

    with TestClient(app) as client:
        response = client.put(
            f"/api/projects/{project.id}/audio",
            files={"audio": ("song.mp3", b"audio", "audio/mpeg")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["audio"] == "song.mp3"
    assert body["audio_sha1"] == file_sha1(project.audio_path)
