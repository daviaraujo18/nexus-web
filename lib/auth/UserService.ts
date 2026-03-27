import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  limit,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';

type UserType = 'student' | 'professional';

export class UserService {
  static async checkEmailExists(email: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();

    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('email', '==', normalizedEmail), limit(1));
    const snapshot = await getDocs(q);

    return !snapshot.empty;
  }

  static async checkCpfExists(cpf: string): Promise<boolean> {
    const normalizedCpf = cpf.replace(/\D/g, '');

    const studentsRef = collection(firestore, 'students');
    const studentsQuery = query(
      studentsRef,
      where('cpf', '==', normalizedCpf),
      limit(1)
    );
    const studentsSnapshot = await getDocs(studentsQuery);

    if (!studentsSnapshot.empty) return true;

    const professionalsRef = collection(firestore, 'professionals');
    const professionalsQuery = query(
      professionalsRef,
      where('cpf', '==', normalizedCpf),
      limit(1)
    );
    const professionalsSnapshot = await getDocs(professionalsQuery);

    return !professionalsSnapshot.empty;
  }

  static async getUserType(
    userId: string,
    email?: string
  ): Promise<UserType> {
    const userRef = doc(firestore, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();

      if (
        data?.active &&
        (data.type === 'student' || data.type === 'professional')
      ) {
        return data.type;
      }
    }

    // fallback 1: procura em students por userId
    const studentsByUserId = await getDocs(
      query(
        collection(firestore, 'students'),
        where('userId', '==', userId),
        limit(1)
      )
    );

    if (!studentsByUserId.empty) {
      const studentData = studentsByUserId.docs[0].data();

      await setDoc(
        userRef,
        {
          id: userId,
          userId,
          email: email ?? studentData.email ?? null,
          name: studentData.name ?? null,
          type: 'student',
          role: 'student',
          active: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return 'student';
    }

    // fallback 2: procura em professionals por userId
    const professionalsByUserId = await getDocs(
      query(
        collection(firestore, 'professionals'),
        where('userId', '==', userId),
        limit(1)
      )
    );

    if (!professionalsByUserId.empty) {
      const professionalData = professionalsByUserId.docs[0].data();

      await setDoc(
        userRef,
        {
          id: userId,
          userId,
          email: email ?? professionalData.email ?? null,
          name: professionalData.name ?? null,
          type: 'professional',
          role: professionalData.role ?? 'professional',
          active: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return 'professional';
    }

    // fallback 3: procura por email em students
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();

      const studentsByEmail = await getDocs(
        query(
          collection(firestore, 'students'),
          where('email', '==', normalizedEmail),
          limit(1)
        )
      );

      if (!studentsByEmail.empty) {
        const studentData = studentsByEmail.docs[0].data();

        await setDoc(
          userRef,
          {
            id: userId,
            userId,
            email: normalizedEmail,
            name: studentData.name ?? null,
            type: 'student',
            role: 'student',
            active: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        return 'student';
      }

      const professionalsByEmail = await getDocs(
        query(
          collection(firestore, 'professionals'),
          where('email', '==', normalizedEmail),
          limit(1)
        )
      );

      if (!professionalsByEmail.empty) {
        const professionalData = professionalsByEmail.docs[0].data();

        await setDoc(
          userRef,
          {
            id: userId,
            userId,
            email: normalizedEmail,
            name: professionalData.name ?? null,
            type: 'professional',
            role: professionalData.role ?? 'professional',
            active: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        return 'professional';
      }
    }

    throw new Error('User profile not found or inactive');
  }

  static async getUser(userId: string, userType: UserType) {
    const collectionName =
      userType === 'student' ? 'students' : 'professionals';

    // tenta pelo id direto
    const directRef = doc(firestore, collectionName, userId);
    const directSnap = await getDoc(directRef);

    if (directSnap.exists()) {
      const data = directSnap.data();

      if (!data?.active) {
        throw new Error('User profile not found or inactive');
      }

      return {
        id: directSnap.id,
        ...data,
      };
    }

    // fallback por userId
    const q = query(
      collection(firestore, collectionName),
      where('userId', '==', userId),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error(`${userType} not found`);
    }

    const profileDoc = snapshot.docs[0];
    const profileData = profileDoc.data();

    if (!profileData?.active) {
      throw new Error('User profile not found or inactive');
    }

    return {
      id: profileDoc.id,
      ...profileData,
    };
  }
}