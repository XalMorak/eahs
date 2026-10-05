#!/usr/bin/env python3
"""ЭАХС Firebase Realtime Database дүрэм үүсгэгч.

  python3 tools/gen-rules.py   ->  database.rules.json             (эцсийн, хэрэглэгч бүрийн эрхтэй)
                                   database.rules.transition.json  (шилжилтийн үе)

Борлуулалтын апп (`borluulalt`)-ын дүрэм ӨӨРЧЛӨГДӨХГҮЙ.
Үүрэг: eahs/v2/roles/{auth.uid} = {sap, role}. Firebase Auth email = <sap>@eahs.local
"""
import json, os

V2 = "eahs/v2"
ROLE = f"root.child('{V2}/roles/'+auth.uid+'/role').val()"
MYSAP = f"root.child('{V2}/roles/'+auth.uid+'/sap').val()"
# Алба зөвхөн 2: «Оффис» агуулсан нэр → 'Оффис', бусад бүх нэр (хуучин «Оюут баар», «Манлай баар» гэх мэт) → 'Бар'.
# Хадгалсан өгөгдлийг өөрчлөхгүй — дүрэм харьцуулахдаа хөрвүүлнэ (апп-ын albaN()-тай ижил).
def NORM(snap):
    return (f"(({snap}.isString() && ({snap}.val().contains('Оффис') || {snap}.val().contains('оффис') || {snap}.val().contains('ОФФИС')))"
            " ? 'Оффис' : 'Бар')")
MYALBA = NORM(f"root.child('{V2}/users/'+{MYSAP}+'/alba')")
SAME_ALBA_NEW = NORM("newData.child('alba')") + " === " + MYALBA
SAME_ALBA_OLD = NORM("data.child('alba')") + " === " + MYALBA
SV_TPLS = "/^(oyut|manlai)$/"   # v7: зөвхөн 2 маягт; хуучин 6 маягтын бичлэг уншигдана, засагдахгүй (эрүүл ахуйч устгаж болно)
SV_VALIDATE = ("!newData.exists() || (newData.child('tpl').isString() && newData.child('tpl').val().matches(" + SV_TPLS + ")"
               " && newData.child('start').isString() && newData.child('start').val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)"
               " && newData.child('heseg').val() === (newData.child('tpl').val() === 'oyut' ? 'Оюут' : 'Манлай')"
               " && newData.child('alba').val() === 'Бар')")
SVCHECK_KIDS = {
    "cells": {"$ik": {"$d": {".validate": "$d.matches(/^d[0-6]$/) && newData.isString() && newData.val().matches(/^(ok|imp|no)$/)"}}},
    "notes": {"$ik": {"$d": {".validate": "$d.matches(/^d[0-6]$/) && newData.isString() && newData.val().length <= 200"}}},
    "sign": {"$d": {".validate": "$d.matches(/^d[0-6]$/) && newData.child('by').isString() && newData.child('by').val().length <= 80"}}}
HYG = f"(auth != null && {ROLE} === 'hygiene')"
SUP = f"(auth != null && {ROLE} === 'supervisor')"
STAFF = f"(auth != null && ({ROLE} === 'hygiene' || {ROLE} === 'supervisor'))"
MEMBER = f"(auth != null && root.child('{V2}/roles/'+auth.uid+'/role').exists())"
ANY = "auth != null"
OWNQ = f"(auth != null && query.orderByChild === 'sap' && query.equalTo === {MYSAP})"
OWN_CREATE = f"({MEMBER} && !data.exists() && newData.child('sap').val() === {MYSAP})"
ROLE_RE = "/^(worker|supervisor|hygiene)$/"

BORLUULALT = {".read": "auth != null", ".write": "auth != null"}

USER_VALIDATE = ("!newData.exists() || (newData.child('name').isString() && newData.child('role').val().matches(" + ROLE_RE + ")"
                 " && !newData.child('pin').exists() && (!newData.child('uid').exists() || newData.child('uid').isString()))")
HZ_VALIDATE = "!newData.exists() || !newData.child('det').exists() || (newData.child('det').isString() && newData.child('det').val().length <= 1000)"

# Хуучин PIN-ээ мэддэг хэрэглэгч анх нэвтрэхдээ өөрийн үүргийг нэг удаа бичнэ (proof = SHA-256(sap:pin) === users/{sap}/pinHash)
U = f"root.child('{V2}/users/'+newData.child('sap').val()"
SELF_CLAIM = ("(auth != null && auth.uid === $uid && !data.exists() && newData.child('sap').isString()"
              " && auth.token.email === newData.child('sap').val().toLowerCase() + '@eahs.local'"
              f" && {U}+'/pinHash').exists()"
              f" && newData.child('proof').val() === {U}+'/pinHash').val()"
              f" && newData.child('role').val() === {U}+'/role').val())")
ROLES = {"$uid": {
    ".read": "auth != null && auth.uid === $uid",
    ".write": f"{HYG} || {SELF_CLAIM}",
    ".validate": "!newData.exists() || (newData.child('sap').isString() && newData.child('role').val().matches(" + ROLE_RE + "))"}}
AUTHGEN = {"$sap": {".read": True, ".write": HYG, ".validate": "!newData.exists() || newData.isString() || newData.isNumber()"}}

HZREF = "newData.parent().parent().child('hazards/'+newData.child('ref').val()+'/risk').val()"
NOTIF_CREATE = (f"(auth != null && !data.exists() && newData.exists() && ("
                f"(newData.child('type').val() === 'hazard' && $id === 'hz_' + newData.child('ref').val() && ({HZREF} === 'Их' || {HZREF} === 'Маш их'))"
                f" || (newData.child('type').val() === 'hygfail' && {STAFF})))"
                # v8: Цагаан дэвтэр / шинжилгээний мэдэгдэл — ахлах зөвхөн өөрийн албаных; давхар үүсгэлтэд (уралдаан) health→health дахин бичиж болно
                f" || (auth != null && newData.exists() && newData.child('type').val() === 'health' && {SUP} && {SAME_ALBA_NEW}"
                f" && (!data.exists() || data.child('type').val() === 'health'))")
NOTIF_VALIDATE = ("!newData.exists() || (newData.child('type').val().matches(/^(hazard|hygfail|health)$/) && newData.child('ts').isNumber()"
                  " && newData.child('title').isString() && newData.child('title').val().length <= 200"
                  " && (!newData.child('body').exists() || (newData.child('body').isString() && newData.child('body').val().length <= 300)))")
DATE_RE = "/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/"
# v8: Цагаан дэвтэр / жилийн шинжилгээний сунгалтын түүх (бичлэг бүр тусдаа; зураг нь photos/rn_<id>)
RENEW_VALIDATE = ("!newData.exists() || (newData.child('sap').isString() && newData.child('kind').val().matches(/^(book|exam)$/)"
                  " && newData.child('exp').isString() && newData.child('exp').val().matches(" + DATE_RE + ")"
                  " && (!newData.child('iss').exists() || (newData.child('iss').isString() && newData.child('iss').val().matches(" + DATE_RE + ")))"
                  " && (!newData.child('note').exists() || (newData.child('note').isString() && newData.child('note').val().length <= 300)))")

def strict():
    return {"rules": {"borluulalt": BORLUULALT, "eahs": {"v2": {
        ".read": HYG,
        "_meta": {".write": f"{HYG} && !data.exists()"},
        "roles": ROLES,
        "authgen": AUTHGEN,
        "users": {
            ".read": STAFF,
            "$sap": {
                ".read": f"auth != null && {MYSAP} === $sap",
                ".write": HYG,
                ".validate": USER_VALIDATE,
                "uid": {".write": f"auth != null && {MYSAP} === $sap && !data.exists() && newData.val() === auth.uid"},
                "pinHash": {".write": f"auth != null && {MYSAP} === $sap && !newData.exists()"},
                "mustChange": {".write": f"auth != null && {MYSAP} === $sap"}}},
        "settings": {".read": MEMBER, ".write": HYG},
        "uhaan": {".read": f"{STAFF} || {OWNQ}", ".indexOn": ["sap"], ".write": HYG,
                  "$id": {".write": f"({SUP} && data.exists() && newData.exists() && {SAME_ALBA_OLD}) || {OWN_CREATE}"}},
        "fatigue": {".read": f"{HYG} || {OWNQ}", ".indexOn": ["sap"], ".write": HYG, "$id": {".write": OWN_CREATE}},
        "infect": {".read": f"{HYG} || {OWNQ}", ".indexOn": ["sap"], ".write": HYG, "$id": {".write": OWN_CREATE}},
        "roster": {".read": MEMBER, ".write": HYG},
        "hygcheck": {".read": MEMBER, ".write": HYG,
            "$id": {".write": f"{SUP} && newData.exists() && {SAME_ALBA_NEW} && (!data.exists() || {SAME_ALBA_OLD})",
                    "rows": {"$rk": {
                        "sign": {".write": f"auth != null && {MYSAP} !== null && newData.parent().child('sap').val() === {MYSAP}"},
                        "signAt": {".write": f"auth != null && {MYSAP} !== null && newData.parent().child('sap').val() === {MYSAP}"}}}}},
        "hazards": {".read": STAFF, ".write": HYG,
            "$id": {".write": f"({SUP} && data.exists() && newData.exists()) || ({ANY} && !data.exists() && newData.child('status').val() === 'Шинэ')",
                    ".validate": HZ_VALIDATE}},
        "photos": {".read": STAFF, ".write": HYG,
            "$id": {".write": f"{ANY} && !data.exists() && newData.parent().parent().child('hazards/'+$id).exists()"}},
        "notifs": {".read": STAFF, ".write": HYG, "$id": {".write": NOTIF_CREATE, ".validate": NOTIF_VALIDATE}},
        # Сунгалтын түүх: эрүүл ахуйч бичнэ; ахлах уншина; ажилтан зөвхөн өөрийнхөө (sap-аар query)
        "renew": {".read": f"{STAFF} || {OWNQ}", ".indexOn": ["sap"], ".write": HYG, "$id": {".validate": RENEW_VALIDATE}},
        # Ахлахын хяналтын хуудас: эрүүл ахуйч + ахлах уншина; ахлах зөвхөн өөрийн албаных (устгахгүй); эрүүл ахуйч бүгд
        "svcheck": {".read": STAFF, ".write": HYG,
            "$id": {".write": f"{SUP} && newData.exists() && {SAME_ALBA_NEW} && (!data.exists() || {SAME_ALBA_OLD})",
                    ".validate": SV_VALIDATE, **SVCHECK_KIDS}},
        "$other": {".write": False}}}}}

def transition():
    """Одоогийн (нэргүй auth != null) дүрэм + шинэ зангилаа. roles/authgen нь эхнээсээ хатуу (эрх булаахаас сэргийлнэ)."""
    w = {".write": ANY}
    return {"rules": {"borluulalt": BORLUULALT, "eahs": {"v2": {
        ".read": ANY,
        "_meta": {".write": f"{ANY} && !data.exists()"},
        "roles": ROLES,
        "authgen": AUTHGEN,
        "users": {"$sap": {".write": ANY, ".validate": USER_VALIDATE}},
        "settings": {".write": ANY},
        "uhaan": {".indexOn": ["sap"], "$id": w}, "fatigue": {".indexOn": ["sap"], "$id": w}, "infect": {".indexOn": ["sap"], "$id": w},
        "roster": {"$id": w}, "hygcheck": {"$id": w},
        "hazards": {"$id": {".write": ANY, ".validate": HZ_VALIDATE}},
        "photos": {"$id": w},
        "notifs": {"$id": {".write": ANY, ".validate": NOTIF_VALIDATE}},
        "renew": {".indexOn": ["sap"], "$id": {".write": ANY, ".validate": RENEW_VALIDATE}},
        "svcheck": {"$id": {".write": ANY, ".validate": SV_VALIDATE, **SVCHECK_KIDS}},
        "$other": {".write": False}}}}}

if __name__ == "__main__":
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for name, r in [("database.rules.json", strict()), ("database.rules.transition.json", transition())]:
        with open(os.path.join(here, name), "w", encoding="utf-8") as f:
            json.dump(r, f, ensure_ascii=False, indent=2); f.write("\n")
        print("wrote", name)
